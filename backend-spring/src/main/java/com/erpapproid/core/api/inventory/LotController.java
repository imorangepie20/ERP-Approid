package com.erpapproid.core.api.inventory;

import java.time.LocalDate;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.inventory.LotDto.Response;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.seq.DomainNumberGenerator;
import com.erpapproid.core.common.seq.DomainNumberGenerator.Prefix;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.inventory.InventoryTransactionEntity;
import com.erpapproid.core.domain.inventory.InventoryTransactionRepository;
import com.erpapproid.core.domain.inventory.LotEntity;
import com.erpapproid.core.domain.inventory.LotRepository;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.sales.ShipmentRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "lots", description = "Lot")
@RestController
@RequestMapping("/api/core/lots")
@RequiredArgsConstructor
public class LotController {

    private final LotRepository lotRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;
    private final ItemRepository itemRepository;
    private final ShipmentRepository shipmentRepository;
    private final DomainNumberGenerator numberGenerator;
    private final AuditService auditService;

    @Operation(summary = "Lot 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<java.util.List<Response>> list(
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String warehouse) {
        java.util.List<LotEntity> rows = lotRepository.findAll().stream()
                .filter(l -> itemId == null || itemId.equals(l.getItem().getId()))
                .filter(l -> status == null || status.equals(l.getStatus()))
                .filter(l -> warehouse == null || warehouse.equals(l.getWarehouse()))
                .toList();
        return ResponseEntity.ok(rows.stream().map(this::toResponse).toList());
    }

    @Operation(summary = "Lot 보류")
    @PostMapping("/{id}/hold")
    @PreAuthorize("hasAnyRole('MATERIAL', 'QUALITY', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> hold(@PathVariable Long id) {
        LotEntity entity = lotRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.LOT_NOT_FOUND,
                        "Lot을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        if (Constants.LOT_DISPOSED.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION, "폐기/취소된 Lot은 보류할 수 없습니다.");
        }
        entity.setStatus(Constants.LOT_HOLD);
        LotEntity saved = lotRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "HOLD", "LOT", saved.getLotNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "Lot 보류 해제")
    @PostMapping("/{id}/release")
    @PreAuthorize("hasAnyRole('MATERIAL', 'QUALITY', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> release(@PathVariable Long id) {
        LotEntity entity = lotRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.LOT_NOT_FOUND,
                        "Lot을 찾을 수 없습니다: " + id));
        if (!Constants.LOT_HOLD.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "보류 상태의 Lot만 해제할 수 있습니다: " + entity.getLotNo());
        }
        Response before = toResponse(entity);
        entity.setStatus(Constants.LOT_OK);
        LotEntity saved = lotRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "RELEASE", "LOT", saved.getLotNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "Lot 폐기 (보상 출고)")
    @PostMapping("/{id}/dispose")
    @PreAuthorize("hasAnyRole('QUALITY', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> dispose(@PathVariable Long id) {
        LotEntity entity = lotRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.LOT_NOT_FOUND,
                        "Lot을 찾을 수 없습니다: " + id));
        if (Constants.LOT_DISPOSED.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "이미 폐기된 Lot입니다: " + entity.getLotNo());
        }
        if (shipmentRepository.existsByLot_IdAndStatusNot(entity.getId(), Constants.CANCELLED)) {
            throw new DomainException(ErrorCode.IN_USE,
                    "출하가 연결된 Lot은 폐기할 수 없습니다. 출하 취소 후 폐기하세요: " + entity.getLotNo());
        }
        Response before = toResponse(entity);
        java.math.BigDecimal disposedQty = entity.getQty();
        ItemEntity item = itemRepository.findForUpdate(entity.getItem().getId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + entity.getItem().getId()));
        entity.setStatus(Constants.LOT_DISPOSED);
        entity.setQty(java.math.BigDecimal.ZERO);
        item.setStock(item.getStock().subtract(disposedQty));
        LotEntity saved = lotRepository.save(entity);
        itemRepository.save(item);

        InventoryTransactionEntity txn = InventoryTransactionEntity.builder()
                .txnNo(numberGenerator.next(Prefix.INVENTORY_TXN, 4))
                .item(entity.getItem())
                .lot(saved)
                .warehouse(entity.getWarehouse())
                .txnType(Constants.TXN_ISSUE)
                .qty(disposedQty.negate())
                .refType("LOT")
                .refNo(saved.getLotNo())
                .txnDate(LocalDate.now())
                .build();
        InventoryTransactionEntity savedTxn = inventoryTransactionRepository.save(txn);

        auditService.record(AuditEvent.changed(
                "DISPOSE", "LOT", saved.getLotNo(), before, toResponse(saved)));
        auditService.record(AuditEvent.created("INVENTORY_TRANSACTION", savedTxn.getTxnNo(),
                java.util.Map.of(
                        "txnNo", savedTxn.getTxnNo(),
                        "itemId", savedTxn.getItem().getId(),
                        "lotId", saved.getId(),
                        "qty", savedTxn.getQty(),
                        "type", savedTxn.getTxnType())));
        return ResponseEntity.ok(toResponse(saved));
    }

    private Response toResponse(LotEntity entity) {
        boolean expiringSoon = entity.getExpiry() != null
                && entity.getExpiry().isBefore(LocalDate.now().plusDays(30));
        return Response.builder()
                .id(entity.getId())
                .lotNo(entity.getLotNo())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .warehouse(entity.getWarehouse())
                .qty(entity.getQty())
                .producedAt(entity.getProducedAt())
                .expiry(entity.getExpiry())
                .status(entity.getStatus())
                .expiringSoon(expiringSoon)
                .build();
    }
}
