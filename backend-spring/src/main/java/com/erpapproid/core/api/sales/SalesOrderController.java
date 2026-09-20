package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.sales.SalesOrderDto.ConfirmResult;
import com.erpapproid.core.api.sales.SalesOrderDto.Request;
import com.erpapproid.core.api.sales.SalesOrderDto.Response;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.seq.DomainNumberGenerator;
import com.erpapproid.core.common.seq.DomainNumberGenerator.Prefix;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.production.WorkOrderEntity;
import com.erpapproid.core.domain.production.WorkOrderRepository;
import com.erpapproid.core.domain.sales.QuotationEntity;
import com.erpapproid.core.domain.sales.QuotationRepository;
import com.erpapproid.core.domain.sales.SalesOrderEntity;
import com.erpapproid.core.domain.sales.SalesOrderRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "sales-orders", description = "수주")
@RestController
@RequestMapping("/api/core/sales-orders")
@RequiredArgsConstructor
public class SalesOrderController {

    private final SalesOrderRepository salesOrderRepository;
    private final QuotationRepository quotationRepository;
    private final PartnerRepository partnerRepository;
    private final ItemRepository itemRepository;
    private final WorkOrderRepository workOrderRepository;
    private final DomainNumberGenerator numberGenerator;
    private final AuditService auditService;

    @Operation(summary = "수주 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                salesOrderRepository.search(status, customerId, keyword, pageable)
                        .map(this::toResponse));
    }

    @Operation(summary = "수주 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(salesOrderRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "신규 수주 등록")
    @PostMapping
    @PreAuthorize("hasRole('SALES')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        SalesOrderEntity entity = buildFromRequest(request);
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        auditService.record("CREATE", "SALES_ORDER", saved.getSalesOrderNo(), toResponse(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "흐름 1: 견적 → 수주")
    @PostMapping("/from-quotation/{quotationId}")
    @PreAuthorize("hasRole('SALES')")
    @Transactional
    public ResponseEntity<Response> createFromQuotation(@PathVariable Long quotationId) {
        QuotationEntity quotation = quotationRepository.findById(quotationId)
                .orElseThrow(() -> new DomainException(ErrorCode.QUOTATION_NOT_FOUND,
                        "견적을 찾을 수 없습니다: " + quotationId));
        if (!Constants.SENT.equals(quotation.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "발송완료 상태의 견적만 수주할 수 있습니다. 현재 상태: " + quotation.getStatus());
        }
        SalesOrderEntity entity = SalesOrderEntity.builder()
                .salesOrderNo(numberGenerator.next(Prefix.SALES_ORDER))
                .quotation(quotation)
                .customer(quotation.getCustomer())
                .item(quotation.getItem())
                .qty(quotation.getQty())
                .unitPrice(quotation.getUnitPrice())
                .amount(quotation.getAmount())
                .dueDate(quotation.getDueDate())
                .status(Constants.WAITING)
                .orderedAt(LocalDate.now())
                .build();
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        quotation.setStatus(Constants.ORDERED);
        quotationRepository.save(quotation);
        auditService.record("CREATE", "SALES_ORDER", saved.getSalesOrderNo(), toResponse(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "흐름 2: 수주 확정 → 작업오더 생성")
    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<ConfirmResult> confirm(@PathVariable Long id) {
        SalesOrderEntity order = salesOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id));
        if (!Constants.WAITING.equals(order.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "대기 상태의 수주만 확정할 수 있습니다. 현재 상태: " + order.getStatus());
        }
        if (!Constants.PRODUCT.equals(order.getItem().getItemType())) {
            throw new DomainException(ErrorCode.ITEM_NOT_PRODUCIBLE,
                    "제품 유형만 생산할 수 있습니다: " + order.getItem().getItemNo());
        }
        Response before = toResponse(order);
        order.setStatus(Constants.CONFIRMED);
        WorkOrderEntity workOrder = WorkOrderEntity.builder()
                .workOrderNo(numberGenerator.next(Prefix.WORK_ORDER))
                .salesOrder(order)
                .item(order.getItem())
                .qty(order.getQty())
                .goodQty(BigDecimal.ZERO)
                .defectQty(BigDecimal.ZERO)
                .progress(BigDecimal.ZERO)
                .startDate(LocalDate.now())
                .dueDate(order.getDueDate())
                .status(Constants.WO_OPEN)
                .build();
        SalesOrderEntity savedOrder = salesOrderRepository.save(order);
        WorkOrderEntity savedWorkOrder = workOrderRepository.save(workOrder);
        auditService.record("CONFIRM", "SALES_ORDER", savedOrder.getSalesOrderNo(),
                before, toResponse(savedOrder));
        auditService.record("CREATE", "WORK_ORDER", savedWorkOrder.getWorkOrderNo(), null);
        return ResponseEntity.ok(ConfirmResult.builder()
                .salesOrder(toResponse(savedOrder))
                .workOrderNo(savedWorkOrder.getWorkOrderNo())
                .build());
    }

    @Operation(summary = "수주 수정 (대기만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('SALES')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        SalesOrderEntity entity = salesOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id));
        if (!Constants.WAITING.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "대기 상태의 수주만 수정할 수 있습니다: " + entity.getSalesOrderNo());
        }
        Response before = toResponse(entity);
        applyRequest(entity, request);
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        auditService.record("UPDATE", "SALES_ORDER", saved.getSalesOrderNo(), before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "수주 취소")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> cancel(@PathVariable Long id) {
        SalesOrderEntity entity = salesOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id));
        if (Constants.SHIPPED.equals(entity.getStatus())
                || Constants.CANCELLED.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "출하완료/취소 상태의 수주는 취소할 수 없습니다: " + entity.getSalesOrderNo());
        }
        Response before = toResponse(entity);
        entity.setStatus(Constants.CANCELLED);
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        auditService.record("CANCEL", "SALES_ORDER", saved.getSalesOrderNo(), before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "수주 삭제 (대기만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SALES')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        SalesOrderEntity entity = salesOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id));
        if (!Constants.WAITING.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "대기 상태의 수주만 삭제할 수 있습니다: " + entity.getSalesOrderNo());
        }
        salesOrderRepository.delete(entity);
        auditService.record("DELETE", "SALES_ORDER", entity.getSalesOrderNo(), null);
        return ResponseEntity.noContent().build();
    }

    private SalesOrderEntity buildFromRequest(Request request) {
        PartnerEntity customer = partnerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + request.getCustomerId()));
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        QuotationEntity quotation = null;
        if (request.getQuotationId() != null) {
            quotation = quotationRepository.findById(request.getQuotationId())
                    .orElseThrow(() -> new DomainException(ErrorCode.QUOTATION_NOT_FOUND,
                            "견적을 찾을 수 없습니다: " + request.getQuotationId()));
        }
        return SalesOrderEntity.builder()
                .salesOrderNo(request.getSalesOrderNo())
                .quotation(quotation)
                .customer(customer)
                .item(item)
                .qty(request.getQty())
                .unitPrice(request.getUnitPrice())
                .amount(request.getQty().multiply(BigDecimal.valueOf(request.getUnitPrice())).longValue())
                .dueDate(request.getDueDate())
                .status(Constants.WAITING)
                .orderedAt(request.getOrderedAt() == null ? LocalDate.now() : request.getOrderedAt())
                .build();
    }

    private void applyRequest(SalesOrderEntity entity, Request request) {
        if (request.getQty() != null) {
            entity.setQty(request.getQty());
        }
        if (request.getUnitPrice() != null) {
            entity.setUnitPrice(request.getUnitPrice());
        }
        if (request.getQty() != null && request.getUnitPrice() != null) {
            entity.setAmount(request.getQty()
                    .multiply(BigDecimal.valueOf(request.getUnitPrice())).longValue());
        }
        if (request.getDueDate() != null) {
            entity.setDueDate(request.getDueDate());
        }
    }

    private Response toResponse(SalesOrderEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .salesOrderNo(entity.getSalesOrderNo())
                .quotationId(entity.getQuotation() == null ? null : entity.getQuotation().getId())
                .quotationNo(entity.getQuotation() == null ? null : entity.getQuotation().getQuotationNo())
                .customerId(entity.getCustomer().getId())
                .customerName(entity.getCustomer().getName())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .qty(entity.getQty())
                .unitPrice(entity.getUnitPrice())
                .amount(entity.getAmount())
                .dueDate(entity.getDueDate())
                .orderedAt(entity.getOrderedAt())
                .status(entity.getStatus())
                .build();
    }
}
