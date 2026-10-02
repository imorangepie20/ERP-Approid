package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

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
import com.erpapproid.core.api.sales.SalesOrderDto.UpdateRequest;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.seq.DomainNumberGenerator;
import com.erpapproid.core.common.seq.DomainNumberGenerator.Prefix;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
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
    private final com.erpapproid.core.domain.production.RoutingSnapshotService routingSnapshots;

    @Operation(summary = "수주 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "salesOrderNo,desc") String sort) {
        var pageable = MasterListQuery.pageable(page, size, sort,
                Set.of("salesOrderNo", "customer.name", "item.itemNo", "qty", "unitPrice", "amount", "dueDate", "orderedAt", "status"), "salesOrderNo");
        return ResponseEntity.ok(
                salesOrderRepository.findAll(SalesDocumentRules.filter("salesOrderNo", status, customerId, keyword,
                        Set.of(Constants.WAITING, Constants.CONFIRMED, Constants.IN_PRODUCTION, Constants.SHIPPED, Constants.CANCELLED)), pageable)
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
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        SalesOrderEntity entity = buildFromRequest(request);
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        auditService.record(AuditEvent.sensitiveCreated(
                "SALES_ORDER", saved.getSalesOrderNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "흐름 1: 견적 → 수주")
    @PostMapping("/from-quotation/{quotationId}")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> createFromQuotation(@PathVariable Long quotationId) {
        QuotationEntity quotation = quotationRepository.findForUpdate(quotationId)
                .orElseThrow(() -> new DomainException(ErrorCode.QUOTATION_NOT_FOUND,
                        "견적을 찾을 수 없습니다: " + quotationId));
        if (!Constants.SENT.equals(quotation.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "발송완료 상태의 견적만 수주할 수 있습니다. 현재 상태: " + quotation.getStatus());
        }
        if (quotation.getValidUntil().isBefore(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")))) {
            throw new DomainException(ErrorCode.QUOTATION_EXPIRED, "유효기간이 지난 견적은 수주로 전환할 수 없습니다.");
        }
        if (salesOrderRepository.existsByQuotationId(quotationId)) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION, "이미 수주로 전환한 견적입니다.");
        }
        SalesDocumentRules.references(quotation.getCustomer(), quotation.getItem());
        java.util.Map<String, Object> quotationBefore = quotationSnapshot(quotation);
        SalesOrderEntity entity = SalesOrderEntity.builder()
                .salesOrderNo(numberGenerator.next(Prefix.SALES_ORDER))
                .quotation(quotation)
                .customer(quotation.getCustomer())
                .item(quotation.getItem())
                .qty(quotation.getQty())
                .unitPrice(quotation.getUnitPrice())
                .amount(quotation.getAmount())
                .paymentTerms(quotation.getPaymentTerms())
                .leadTimeDays(quotation.getLeadTimeDays())
                .dueDate(quotation.getDueDate())
                .status(Constants.WAITING)
                .orderedAt(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")))
                .build();
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        quotation.setStatus(Constants.ORDERED);
        quotationRepository.save(quotation);
        auditService.record(AuditEvent.sensitiveCreated(
                "SALES_ORDER", saved.getSalesOrderNo(), toResponse(saved)));
        auditService.record(AuditEvent.changed("ORDER", "QUOTATION", quotation.getQuotationNo(),
                quotationBefore, quotationSnapshot(quotation)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "흐름 2: 수주 확정 → 작업오더 생성")
    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<ConfirmResult> confirm(@PathVariable Long id) {
        SalesOrderEntity order = salesOrderRepository.findForUpdate(id)
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
                .routingSteps(routingSnapshots.capture(order.getItem().getId()))
                .build();
        SalesOrderEntity savedOrder = salesOrderRepository.save(order);
        WorkOrderEntity savedWorkOrder = workOrderRepository.save(workOrder);
        auditService.record(AuditEvent.sensitiveChange("CONFIRM", "SALES_ORDER",
                savedOrder.getSalesOrderNo(), before, toResponse(savedOrder)));
        auditService.record(AuditEvent.created(
                "WORK_ORDER", savedWorkOrder.getWorkOrderNo(), workOrderSnapshot(savedWorkOrder)));
        return ResponseEntity.ok(ConfirmResult.builder()
                .salesOrder(toResponse(savedOrder))
                .workOrderNo(savedWorkOrder.getWorkOrderNo())
                .workOrderId(savedWorkOrder.getId())
                .build());
    }

    @Operation(summary = "수주 수정 (대기만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) throw MasterListQuery.invalid("수정할 값을 입력하세요.");
        SalesOrderEntity entity = salesOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id));
        if (!Constants.WAITING.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "대기 상태의 수주만 수정할 수 있습니다: " + entity.getSalesOrderNo());
        }
        Response before = toResponse(entity);
        applyRequest(entity, request);
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange(
                "UPDATE", "SALES_ORDER", saved.getSalesOrderNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "수주 취소 (대기만, 확정 후 보상 처리는 후속 생산 업무)")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> cancel(@PathVariable Long id) {
        SalesOrderEntity entity = salesOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id));
        if (!Constants.WAITING.equals(entity.getStatus()) || !workOrderRepository.findBySalesOrderId(id).isEmpty()) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "작업오더가 없는 대기 상태의 수주만 취소할 수 있습니다: " + entity.getSalesOrderNo());
        }
        Response before = toResponse(entity);
        entity.setStatus(Constants.CANCELLED);
        SalesOrderEntity saved = salesOrderRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange(
                "CANCEL", "SALES_ORDER", saved.getSalesOrderNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "수주 삭제 (대기만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        SalesOrderEntity entity = salesOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + id));
        if (!Constants.WAITING.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "대기 상태의 수주만 삭제할 수 있습니다: " + entity.getSalesOrderNo());
        }
        Response before = toResponse(entity);
        if (entity.getQuotation() != null || !workOrderRepository.findBySalesOrderId(id).isEmpty()) {
            throw new DomainException(ErrorCode.IN_USE, "견적이나 작업오더에 연결된 수주는 삭제할 수 없습니다. 취소를 사용하세요.");
        }
        salesOrderRepository.delete(entity);
        auditService.record(AuditEvent.sensitiveDeleted(
                "SALES_ORDER", entity.getSalesOrderNo(), before));
        return ResponseEntity.noContent().build();
    }

    private SalesOrderEntity buildFromRequest(Request request) {
        if (request.getQuotationId() != null) throw MasterListQuery.invalid("견적 전환 전용 endpoint를 사용하세요.");
        if (salesOrderRepository.existsBySalesOrderNo(request.getSalesOrderNo())) {
            throw new DomainException(ErrorCode.SALES_ORDER_NO_DUPLICATE, "이미 사용 중인 수주번호입니다.");
        }
        PartnerEntity customer = partnerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + request.getCustomerId()));
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        SalesDocumentRules.references(customer, item);
        return SalesOrderEntity.builder()
                .salesOrderNo(request.getSalesOrderNo())
                .customer(customer)
                .item(item)
                .qty(request.getQty())
                .unitPrice(request.getUnitPrice())
                .amount(SalesDocumentRules.amount(request.getQty(), request.getUnitPrice()))
                .paymentTerms(customer.getPaymentTerms())
                .leadTimeDays(customer.getLeadTimeDays())
                .dueDate(request.getDueDate())
                .status(Constants.WAITING)
                .orderedAt(request.getOrderedAt() == null ? LocalDate.now(java.time.ZoneId.of("Asia/Seoul")) : request.getOrderedAt())
                .build();
    }

    private void applyRequest(SalesOrderEntity entity, UpdateRequest request) {
        if (request.getQty() != null) {
            entity.setQty(request.getQty());
        }
        if (request.getUnitPrice() != null) {
            entity.setUnitPrice(request.getUnitPrice());
        }
        entity.setAmount(SalesDocumentRules.amount(entity.getQty(), entity.getUnitPrice()));
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
                .paymentTerms(entity.getPaymentTerms())
                .leadTimeDays(entity.getLeadTimeDays())
                .workOrderNos(workOrderRepository.findBySalesOrderId(entity.getId()).stream()
                        .map(WorkOrderEntity::getWorkOrderNo).sorted().toList())
                .build();
    }

    private java.util.Map<String, Object> quotationSnapshot(QuotationEntity entity) {
        return java.util.Map.of(
                "id", entity.getId(),
                "quotationNo", entity.getQuotationNo(),
                "status", entity.getStatus());
    }

    private java.util.Map<String, Object> workOrderSnapshot(WorkOrderEntity entity) {
        return java.util.Map.of(
                "id", entity.getId(),
                "workOrderNo", entity.getWorkOrderNo(),
                "itemId", entity.getItem().getId(),
                "qty", entity.getQty(),
                "routingSteps", entity.getRoutingSteps(),
                "status", entity.getStatus());
    }
}
