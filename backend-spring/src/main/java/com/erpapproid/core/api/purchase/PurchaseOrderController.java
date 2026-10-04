package com.erpapproid.core.api.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Set;

import org.springframework.data.domain.Page;
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

import com.erpapproid.core.api.purchase.PurchaseOrderDto.Request;
import com.erpapproid.core.api.purchase.PurchaseOrderDto.Response;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.purchase.PurchaseOrderEntity;
import com.erpapproid.core.domain.purchase.PurchaseOrderRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "purchase-orders", description = "발주")
@RestController
@RequestMapping("/api/core/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PartnerRepository partnerRepository;
    private final ItemRepository itemRepository;
    private final AuditService auditService;

    @Operation(summary = "발주 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long vendorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "purchaseOrderNo,asc") String sort) {
        MasterListQuery.positiveId(vendorId);
        if (status != null && !Set.of(Constants.PO_OPEN, Constants.PO_PARTIAL, Constants.PO_CLOSED, Constants.PO_CANCEL).contains(status)) {
            throw MasterListQuery.invalid("지원하지 않는 발주 상태입니다.");
        }
        var pageable = MasterListQuery.pageable(page, size, sort, Set.of("purchaseOrderNo", "qty", "dueDate", "receivedQty", "status"), "purchaseOrderNo");
        return ResponseEntity.ok(
                purchaseOrderRepository.search(status, vendorId, pageable).map(this::toResponse));
    }

    @Operation(summary = "발주 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseOrderRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.PURCHASE_ORDER_NOT_FOUND,
                        "발주를 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "발주 생성")
    @PostMapping
    @PreAuthorize("hasAnyRole('MATERIAL', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        PartnerEntity vendor = partnerRepository.findById(request.getVendorId())
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "발주처를 찾을 수 없습니다: " + request.getVendorId()));
        if (!"발주처".equals(vendor.getPartnerType())) {
            throw MasterListQuery.invalid("발주처 거래처를 선택해야 합니다.");
        }
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        PurchaseOrderEntity entity = PurchaseOrderEntity.builder()
                .purchaseOrderNo(request.getPurchaseOrderNo())
                .vendor(vendor)
                .item(item)
                .qty(request.getQty())
                .unitPrice(request.getUnitPrice())
                .amount(amount(request.getQty(), request.getUnitPrice()))
                .dueDate(request.getDueDate())
                .status(Constants.PO_OPEN)
                .receivedQty(BigDecimal.ZERO)
                .build();
        PurchaseOrderEntity saved = purchaseOrderRepository.save(entity);
        auditService.record(AuditEvent.sensitiveCreated(
                "PURCHASE_ORDER", saved.getPurchaseOrderNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "발주 수정 (발주만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('MATERIAL')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        PurchaseOrderEntity entity = purchaseOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PURCHASE_ORDER_NOT_FOUND,
                        "발주를 찾을 수 없습니다: " + id));
        if (!Constants.PO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "발주 상태의 발주서만 수정할 수 있습니다: " + entity.getPurchaseOrderNo());
        }
        Response before = toResponse(entity);
        if (request.getQty() != null) {
            entity.setQty(request.getQty());
        }
        if (request.getUnitPrice() != null) {
            entity.setUnitPrice(request.getUnitPrice());
        }
        if (request.getQty() != null && request.getUnitPrice() != null) {
            entity.setAmount(amount(request.getQty(), request.getUnitPrice()));
        }
        if (request.getDueDate() != null) {
            entity.setDueDate(request.getDueDate());
        }
        PurchaseOrderEntity saved = purchaseOrderRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange("UPDATE", "PURCHASE_ORDER",
                saved.getPurchaseOrderNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "발주 삭제 (발주만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MATERIAL')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        PurchaseOrderEntity entity = purchaseOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PURCHASE_ORDER_NOT_FOUND,
                        "발주를 찾을 수 없습니다: " + id));
        if (!Constants.PO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "발주 상태의 발주서만 삭제할 수 있습니다: " + entity.getPurchaseOrderNo());
        }
        Response before = toResponse(entity);
        purchaseOrderRepository.delete(entity);
        auditService.record(AuditEvent.sensitiveDeleted(
                "PURCHASE_ORDER", entity.getPurchaseOrderNo(), before));
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "발주 취소")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('MATERIAL', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> cancel(@PathVariable Long id) {
        PurchaseOrderEntity entity = purchaseOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PURCHASE_ORDER_NOT_FOUND,
                        "발주를 찾을 수 없습니다: " + id));
        if (Constants.PO_CLOSED.equals(entity.getStatus())
                || Constants.PO_CANCEL.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.PURCHASE_ORDER_CLOSED,
                    "입고완료/취소된 발주는 취소할 수 없습니다: " + entity.getPurchaseOrderNo());
        }
        Response before = toResponse(entity);
        entity.setStatus(Constants.PO_CANCEL);
        PurchaseOrderEntity saved = purchaseOrderRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange("CANCEL", "PURCHASE_ORDER",
                saved.getPurchaseOrderNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    private long amount(BigDecimal qty, long price) {
        BigDecimal amount = qty.multiply(BigDecimal.valueOf(price)).setScale(0, RoundingMode.DOWN);
        if (amount.compareTo(BigDecimal.valueOf(9007199254740991L)) > 0) {
            throw MasterListQuery.invalid("발주 금액이 지원 범위를 초과했습니다.");
        }
        return amount.longValueExact();
    }

    private Response toResponse(PurchaseOrderEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .purchaseOrderNo(entity.getPurchaseOrderNo())
                .vendorId(entity.getVendor().getId())
                .vendorName(entity.getVendor().getName())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .qty(entity.getQty())
                .unitPrice(entity.getUnitPrice())
                .amount(entity.getAmount())
                .dueDate(entity.getDueDate())
                .status(entity.getStatus())
                .receivedQty(entity.getReceivedQty())
                .build();
    }
}
