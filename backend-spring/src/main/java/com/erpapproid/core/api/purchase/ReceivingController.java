package com.erpapproid.core.api.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import java.util.ArrayList;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.purchase.ReceivingDto.CreateResult;
import com.erpapproid.core.api.purchase.ReceivingDto.Request;
import com.erpapproid.core.api.purchase.ReceivingDto.Response;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.api.MasterListQuery;
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
import com.erpapproid.core.domain.purchase.PurchaseOrderEntity;
import com.erpapproid.core.domain.purchase.PurchaseOrderRepository;
import com.erpapproid.core.domain.purchase.ReceivingEntity;
import com.erpapproid.core.domain.purchase.ReceivingRepository;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.item.ItemEntity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "receivings", description = "입고")
@RestController
@RequestMapping("/api/core/receivings")
@RequiredArgsConstructor
public class ReceivingController {

    private final ReceivingRepository receivingRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final LotRepository lotRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;
    private final DomainNumberGenerator numberGenerator;
    private final AuditService auditService;
    private final ItemRepository itemRepository;

    @Operation(summary = "입고 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) Long purchaseOrderId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long vendorId,
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "receivingNo,desc") String sort) {
        var pageable = MasterListQuery.pageable(page, size, sort, Set.of("receivingNo", "purchaseOrder.purchaseOrderNo",
                "vendor.name", "item.itemNo", "orderQty", "receivedQty", "defectQty", "receivedDate", "status"), "receivingNo");
        for (Long id : new Long[]{purchaseOrderId, vendorId, itemId}) MasterListQuery.positiveId(id);
        String selected = status == null || status.isBlank() ? null : status;
        if (selected != null && !Set.of(Constants.RC_INSPECT, Constants.RC_PASS, Constants.RC_PARTIAL, Constants.RC_FAIL,
                Constants.RC_RETURN, Constants.RC_CANCEL).contains(selected)) throw MasterListQuery.invalid("지원하지 않는 입고 상태입니다.");
        String pattern = MasterListQuery.keyword(keyword);
        org.springframework.data.jpa.domain.Specification<ReceivingEntity> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (purchaseOrderId != null) predicates.add(cb.equal(root.get("purchaseOrder").get("id"), purchaseOrderId));
            if (vendorId != null) predicates.add(cb.equal(root.get("vendor").get("id"), vendorId));
            if (itemId != null) predicates.add(cb.equal(root.get("item").get("id"), itemId));
            if (selected != null) predicates.add(cb.equal(root.get("status"), selected));
            if (pattern != null) predicates.add(cb.or(cb.like(cb.lower(root.get("receivingNo")), pattern, '!'),
                    cb.like(cb.lower(root.get("purchaseOrder").get("purchaseOrderNo")), pattern, '!'),
                    cb.like(cb.lower(root.get("vendor").get("name")), pattern, '!'),
                    cb.like(cb.lower(root.get("item").get("itemNo")), pattern, '!'),
                    cb.like(cb.lower(root.get("item").get("name")), pattern, '!')));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return ResponseEntity.ok(receivingRepository.findAll(spec, pageable).map(this::toResponse));
    }

    @Operation(summary = "입고 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(receivingRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND,
                        "입고를 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "흐름 3: 발주 → 입고")
    @PostMapping
    @PreAuthorize("hasAnyRole('MATERIAL', 'ADMIN')")
    @Transactional
    public ResponseEntity<CreateResult> create(@Valid @RequestBody Request request) {
        PurchaseOrderEntity purchaseOrder = purchaseOrderRepository.findForUpdate(request.getPurchaseOrderId())
                .orElseThrow(() -> new DomainException(ErrorCode.PURCHASE_ORDER_NOT_FOUND,
                        "발주를 찾을 수 없습니다: " + request.getPurchaseOrderId()));
        if (!Set.of(Constants.PO_OPEN, Constants.PO_PARTIAL).contains(purchaseOrder.getStatus())) {
            throw new DomainException(ErrorCode.PURCHASE_ORDER_CLOSED,
                    "입고완료/취소된 발주는 입고할 수 없습니다: " + purchaseOrder.getPurchaseOrderNo());
        }
        BigDecimal defectQty = request.getDefectQty() == null
                ? BigDecimal.ZERO : request.getDefectQty();
        if (defectQty.compareTo(request.getReceivedQty()) > 0) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "불량수량은 총 입고수량을 초과할 수 없습니다.");
        }
        BigDecimal remaining = purchaseOrder.getQty().subtract(purchaseOrder.getReceivedQty());
        if (request.getReceivedQty().compareTo(remaining) > 0) {
            throw new DomainException(ErrorCode.RECEIVED_QTY_EXCEEDS_ORDER,
                    "잔량을 초과하여 입고할 수 없습니다. 잔량: " + remaining
                            + ", 입고: " + request.getReceivedQty());
        }
        BigDecimal goodQty = request.getReceivedQty().subtract(defectQty);
        String status = goodQty.signum() == 0 ? Constants.RC_FAIL : defectQty.compareTo(BigDecimal.ZERO) > 0
                ? Constants.RC_PARTIAL : Constants.RC_PASS;
        ItemEntity item = itemRepository.findForUpdate(purchaseOrder.getItem().getId()).orElseThrow();
        BigDecimal stockBefore = item.getStock();
        BigDecimal stockAfter = stockBefore.add(goodQty);
        if (stockAfter.compareTo(new BigDecimal("99999999999999.9999")) > 0) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "현재고가 저장 가능한 범위를 초과합니다.");
        }
        item.setStock(stockAfter);

        java.util.Map<String, Object> purchaseOrderBefore = purchaseOrderSnapshot(purchaseOrder);
        ReceivingEntity receiving = ReceivingEntity.builder()
                .receivingNo(numberGenerator.next(Prefix.RECEIVING))
                .purchaseOrder(purchaseOrder)
                .vendor(purchaseOrder.getVendor())
                .item(item)
                .orderQty(purchaseOrder.getQty())
                .receivedQty(request.getReceivedQty())
                .defectQty(defectQty)
                .receivedDate(request.getReceivedDate() == null
                        ? today() : request.getReceivedDate())
                .status(status)
                .stockApplied(true)
                .build();
        ReceivingEntity savedReceiving = receivingRepository.save(receiving);

        BigDecimal newReceivedQty = purchaseOrder.getReceivedQty().add(request.getReceivedQty());
        purchaseOrder.setReceivedQty(newReceivedQty);
        purchaseOrder.setStatus(newReceivedQty.compareTo(purchaseOrder.getQty()) >= 0
                ? Constants.PO_CLOSED : Constants.PO_PARTIAL);
        purchaseOrderRepository.save(purchaseOrder);

        LotEntity savedLot = null;
        InventoryTransactionEntity savedTxn = null;
        if (goodQty.signum() > 0) {
            LotEntity lot = LotEntity.builder()
                    .lotNo(numberGenerator.next(Prefix.LOT)).item(item)
                    .warehouse(Constants.WAREHOUSE_MATERIAL).qty(goodQty)
                    .producedAt(savedReceiving.getReceivedDate()).expiry(LocalDate.of(9999, 12, 31))
                    .status(Constants.LOT_OK).build();
            savedLot = lotRepository.save(lot);
            InventoryTransactionEntity txn = InventoryTransactionEntity.builder()
                    .txnNo(numberGenerator.next(Prefix.INVENTORY_TXN, 4)).item(item).lot(savedLot)
                    .warehouse(Constants.WAREHOUSE_MATERIAL).txnType(Constants.TXN_RECEIVE).qty(goodQty)
                    .refType("RECEIVING").refNo(savedReceiving.getReceivingNo()).txnDate(savedReceiving.getReceivedDate()).build();
            savedTxn = inventoryTransactionRepository.save(txn);
            savedReceiving.setLot(savedLot);
            savedReceiving.setInventoryTransaction(savedTxn);
        }

        auditService.record(AuditEvent.created(
                "RECEIVING", savedReceiving.getReceivingNo(), toResponse(savedReceiving)));
        auditService.record(AuditEvent.changed("RECEIVE", "PURCHASE_ORDER",
                purchaseOrder.getPurchaseOrderNo(), purchaseOrderBefore,
                purchaseOrderSnapshot(purchaseOrder)));
        if (savedLot != null) {
            auditService.record(AuditEvent.created("LOT", savedLot.getLotNo(), lotSnapshot(savedLot)));
            auditService.record(AuditEvent.created(
                    "INVENTORY_TRANSACTION", savedTxn.getTxnNo(), transactionSnapshot(savedTxn)));
        }
        auditStock(item, stockBefore, stockAfter, "RECEIVE");
        CreateResult result = CreateResult.builder()
                .receiving(toResponse(savedReceiving))
                .lotNo(savedLot == null ? null : savedLot.getLotNo())
                .inventoryTxnNo(savedTxn == null ? null : savedTxn.getTxnNo())
                .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @Operation(summary = "입고 이력 삭제 금지 (취소 보상 API 사용)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MATERIAL', 'ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ReceivingEntity entity = receivingRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND,
                        "입고를 찾을 수 없습니다: " + id));
        throw new DomainException(ErrorCode.IN_USE, "입고 이력은 삭제하지 않습니다. 취소 보상 API를 사용하세요: " + entity.getReceivingNo());
    }

    @Operation(summary = "입고 취소 (미사용 Lot 역출고 보상)")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('MATERIAL', 'ADMIN')")
    @Transactional
    public ResponseEntity<CreateResult> cancel(@PathVariable Long id) {
        ReceivingEntity receipt = receivingRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND, "입고를 찾을 수 없습니다: " + id));
        if (!Set.of(Constants.RC_PASS, Constants.RC_PARTIAL, Constants.RC_FAIL).contains(receipt.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION, "처리된 입고만 한 번 취소할 수 있습니다.");
        }
        if (!receipt.isStockApplied()) throw new DomainException(ErrorCode.IN_USE, "과거 입고는 재고 반영/연결 정보 확인이 필요하여 자동 취소할 수 없습니다.");
        PurchaseOrderEntity purchaseOrder = purchaseOrderRepository.findForUpdate(receipt.getPurchaseOrder().getId()).orElseThrow();
        ItemEntity item = itemRepository.findForUpdate(receipt.getItem().getId()).orElseThrow();
        BigDecimal goodQty = receipt.getReceivedQty().subtract(receipt.getDefectQty());
        BigDecimal stockBefore = item.getStock();
        if (stockBefore.compareTo(goodQty) < 0 || purchaseOrder.getReceivedQty().compareTo(receipt.getReceivedQty()) < 0) {
            throw new DomainException(ErrorCode.IN_USE, "재고 또는 발주 누적입고가 부족하여 취소할 수 없습니다.");
        }
        Response before;
        var purchaseBefore = purchaseOrderSnapshot(purchaseOrder);
        InventoryTransactionEntity reversal = null;
        if (goodQty.signum() > 0) {
            if (receipt.getLot() == null || receipt.getInventoryTransaction() == null) throw new DomainException(ErrorCode.IN_USE, "원 입고 연결 정보가 없습니다.");
            LotEntity lot = lotRepository.findForUpdate(receipt.getLot().getId()).orElseThrow();
            before = toResponse(receipt);
            if (!Constants.LOT_OK.equals(lot.getStatus()) || lot.getQty().compareTo(goodQty) != 0
                    || inventoryTransactionRepository.existsByLot_IdAndIdNot(lot.getId(), receipt.getInventoryTransaction().getId())) {
                throw new DomainException(ErrorCode.IN_USE, "이미 사용/변경/보류/폐기된 Lot은 입고 취소할 수 없습니다.");
            }
            var lotBefore = lotSnapshot(lot);
            lot.setQty(BigDecimal.ZERO);
            lot.setStatus(Constants.LOT_DISPOSED);
            reversal = inventoryTransactionRepository.save(InventoryTransactionEntity.builder()
                    .txnNo(numberGenerator.next(Prefix.INVENTORY_TXN, 4)).item(item).lot(lot).warehouse(lot.getWarehouse())
                    .txnType(Constants.TXN_ISSUE).qty(goodQty.negate()).refType("RECEIVING_CANCEL").refNo(receipt.getReceivingNo()).txnDate(today()).build());
            receipt.setReversalTransaction(reversal);
            auditService.record(AuditEvent.changed("RECEIVING_CANCEL", "LOT", lot.getLotNo(), lotBefore, lotSnapshot(lot)));
            auditService.record(AuditEvent.created("INVENTORY_TRANSACTION", reversal.getTxnNo(), transactionSnapshot(reversal)));
        } else { before = toResponse(receipt); }
        item.setStock(stockBefore.subtract(goodQty));
        purchaseOrder.setReceivedQty(purchaseOrder.getReceivedQty().subtract(receipt.getReceivedQty()));
        if (!Constants.PO_CANCEL.equals(purchaseOrder.getStatus())) {
            purchaseOrder.setStatus(purchaseOrder.getReceivedQty().signum() == 0 ? Constants.PO_OPEN : Constants.PO_PARTIAL);
        }
        receipt.setStatus(Constants.RC_CANCEL);
        receipt.setCancelledDate(today());
        auditService.record(AuditEvent.changed("CANCEL", "RECEIVING", receipt.getReceivingNo(), before, toResponse(receipt)));
        auditService.record(AuditEvent.changed("RECEIVING_CANCEL", "PURCHASE_ORDER", purchaseOrder.getPurchaseOrderNo(), purchaseBefore, purchaseOrderSnapshot(purchaseOrder)));
        auditStock(item, stockBefore, item.getStock(), "RECEIVING_CANCEL");
        return ResponseEntity.ok(CreateResult.builder().receiving(toResponse(receipt))
                .lotNo(receipt.getLot() == null ? null : receipt.getLot().getLotNo())
                .inventoryTxnNo(reversal == null ? null : reversal.getTxnNo()).build());
    }

    private LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }

    private void auditStock(ItemEntity item, BigDecimal before, BigDecimal after, String action) {
        auditService.record(AuditEvent.changed(action, "ITEM", item.getItemNo(),
                java.util.Map.of("id", item.getId(), "stock", before), java.util.Map.of("id", item.getId(), "stock", after)));
    }

    private Response toResponse(ReceivingEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .receivingNo(entity.getReceivingNo())
                .purchaseOrderId(entity.getPurchaseOrder().getId())
                .purchaseOrderNo(entity.getPurchaseOrder().getPurchaseOrderNo())
                .vendorId(entity.getVendor().getId())
                .vendorName(entity.getVendor().getName())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .orderQty(entity.getOrderQty())
                .receivedQty(entity.getReceivedQty())
                .defectQty(entity.getDefectQty())
                .receivedDate(entity.getReceivedDate())
                .status(entity.getStatus())
                .goodQty(entity.getReceivedQty().subtract(entity.getDefectQty()))
                .lotNo(entity.getLot() == null ? null : entity.getLot().getLotNo())
                .inventoryTxnNo(entity.getInventoryTransaction() == null ? null : entity.getInventoryTransaction().getTxnNo())
                .reversalTxnNo(entity.getReversalTransaction() == null ? null : entity.getReversalTransaction().getTxnNo())
                .cancelledDate(entity.getCancelledDate())
                .stockApplied(entity.isStockApplied())
                .build();
    }

    private java.util.Map<String, Object> purchaseOrderSnapshot(PurchaseOrderEntity entity) {
        return java.util.Map.of(
                "id", entity.getId(),
                "purchaseOrderNo", entity.getPurchaseOrderNo(),
                "receivedQty", entity.getReceivedQty(),
                "status", entity.getStatus());
    }

    private java.util.Map<String, Object> lotSnapshot(LotEntity entity) {
        return java.util.Map.of(
                "id", entity.getId(),
                "lotNo", entity.getLotNo(),
                "itemId", entity.getItem().getId(),
                "warehouse", entity.getWarehouse(),
                "qty", entity.getQty(),
                "status", entity.getStatus());
    }

    private java.util.Map<String, Object> transactionSnapshot(InventoryTransactionEntity entity) {
        return java.util.Map.of(
                "id", entity.getId(),
                "txnNo", entity.getTxnNo(),
                "itemId", entity.getItem().getId(),
                "lotId", entity.getLot().getId(),
                "warehouse", entity.getWarehouse(),
                "type", entity.getTxnType(),
                "qty", entity.getQty());
    }
}
