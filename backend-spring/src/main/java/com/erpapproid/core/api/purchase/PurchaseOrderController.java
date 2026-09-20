package com.erpapproid.core.api.purchase;

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

import com.erpapproid.core.api.purchase.PurchaseOrderDto.Request;
import com.erpapproid.core.api.purchase.PurchaseOrderDto.Response;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
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
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long vendorId,
            @PageableDefault(size = 20) Pageable pageable) {
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
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        PartnerEntity vendor = partnerRepository.findById(request.getVendorId())
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "발주처를 찾을 수 없습니다: " + request.getVendorId()));
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        PurchaseOrderEntity entity = PurchaseOrderEntity.builder()
                .purchaseOrderNo(request.getPurchaseOrderNo())
                .vendor(vendor)
                .item(item)
                .qty(request.getQty())
                .unitPrice(request.getUnitPrice())
                .amount(request.getQty().multiply(BigDecimal.valueOf(request.getUnitPrice())).longValue())
                .dueDate(request.getDueDate())
                .status(Constants.PO_OPEN)
                .receivedQty(BigDecimal.ZERO)
                .build();
        PurchaseOrderEntity saved = purchaseOrderRepository.save(entity);
        auditService.record("CREATE", "PURCHASE_ORDER", saved.getPurchaseOrderNo(), toResponse(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "발주 수정 (발주만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('MATERIAL')")
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        PurchaseOrderEntity entity = purchaseOrderRepository.findById(id)
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
            entity.setAmount(request.getQty()
                    .multiply(BigDecimal.valueOf(request.getUnitPrice())).longValue());
        }
        if (request.getDueDate() != null) {
            entity.setDueDate(request.getDueDate());
        }
        PurchaseOrderEntity saved = purchaseOrderRepository.save(entity);
        auditService.record("UPDATE", "PURCHASE_ORDER", saved.getPurchaseOrderNo(),
                before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "발주 삭제 (발주만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MATERIAL')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        PurchaseOrderEntity entity = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PURCHASE_ORDER_NOT_FOUND,
                        "발주를 찾을 수 없습니다: " + id));
        if (!Constants.PO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "발주 상태의 발주서만 삭제할 수 있습니다: " + entity.getPurchaseOrderNo());
        }
        purchaseOrderRepository.delete(entity);
        auditService.record("DELETE", "PURCHASE_ORDER", entity.getPurchaseOrderNo(), null);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "발주 취소")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('MATERIAL', 'ADMIN')")
    public ResponseEntity<Response> cancel(@PathVariable Long id) {
        PurchaseOrderEntity entity = purchaseOrderRepository.findById(id)
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
        auditService.record("CANCEL", "PURCHASE_ORDER", saved.getPurchaseOrderNo(),
                before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
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
