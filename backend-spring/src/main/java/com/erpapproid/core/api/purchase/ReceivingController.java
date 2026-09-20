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
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.seq.DomainNumberGenerator;
import com.erpapproid.core.common.seq.DomainNumberGenerator.Prefix;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.inventory.InventoryTransactionEntity;
import com.erpapproid.core.domain.inventory.InventoryTransactionRepository;
import com.erpapproid.core.domain.inventory.LotEntity;
import com.erpapproid.core.domain.inventory.LotRepository;
import com.erpapproid.core.domain.purchase.PurchaseOrderEntity;
import com.erpapproid.core.domain.purchase.PurchaseOrderRepository;
import com.erpapproid.core.domain.purchase.ReceivingEntity;
import com.erpapproid.core.domain.purchase.ReceivingRepository;

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

    @Operation(summary = "입고 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) Long purchaseOrderId,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                receivingRepository.search(purchaseOrderId, status, pageable).map(this::toResponse));
    }

    @Operation(summary = "입고 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
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
        PurchaseOrderEntity purchaseOrder = purchaseOrderRepository.findById(request.getPurchaseOrderId())
                .orElseThrow(() -> new DomainException(ErrorCode.PURCHASE_ORDER_NOT_FOUND,
                        "발주를 찾을 수 없습니다: " + request.getPurchaseOrderId()));
        if (Constants.PO_CLOSED.equals(purchaseOrder.getStatus())
                || Constants.PO_CANCEL.equals(purchaseOrder.getStatus())) {
            throw new DomainException(ErrorCode.PURCHASE_ORDER_CLOSED,
                    "입고완료/취소된 발주는 입고할 수 없습니다: " + purchaseOrder.getPurchaseOrderNo());
        }
        BigDecimal defectQty = request.getDefectQty() == null
                ? BigDecimal.ZERO : request.getDefectQty();
        BigDecimal remaining = purchaseOrder.getQty().subtract(purchaseOrder.getReceivedQty());
        if (request.getReceivedQty().compareTo(remaining) > 0) {
            throw new DomainException(ErrorCode.RECEIVED_QTY_EXCEEDS_ORDER,
                    "잔량을 초과하여 입고할 수 없습니다. 잔량: " + remaining
                            + ", 입고: " + request.getReceivedQty());
        }
        String status = defectQty.compareTo(BigDecimal.ZERO) > 0
                ? Constants.RC_PARTIAL : Constants.RC_PASS;

        ReceivingEntity receiving = ReceivingEntity.builder()
                .receivingNo(numberGenerator.next(Prefix.RECEIVING))
                .purchaseOrder(purchaseOrder)
                .vendor(purchaseOrder.getVendor())
                .item(purchaseOrder.getItem())
                .orderQty(purchaseOrder.getQty())
                .receivedQty(request.getReceivedQty())
                .defectQty(defectQty)
                .receivedDate(request.getReceivedDate() == null
                        ? LocalDate.now() : request.getReceivedDate())
                .status(status)
                .build();
        ReceivingEntity savedReceiving = receivingRepository.save(receiving);

        BigDecimal newReceivedQty = purchaseOrder.getReceivedQty().add(request.getReceivedQty());
        purchaseOrder.setReceivedQty(newReceivedQty);
        purchaseOrder.setStatus(newReceivedQty.compareTo(purchaseOrder.getQty()) >= 0
                ? Constants.PO_CLOSED : Constants.PO_PARTIAL);
        purchaseOrderRepository.save(purchaseOrder);

        BigDecimal goodQty = request.getReceivedQty().subtract(defectQty);
        LotEntity lot = LotEntity.builder()
                .lotNo(numberGenerator.next(Prefix.LOT))
                .item(purchaseOrder.getItem())
                .warehouse(Constants.WAREHOUSE_MATERIAL)
                .qty(goodQty)
                .producedAt(savedReceiving.getReceivedDate())
                .expiry(LocalDate.of(9999, 12, 31))
                .status(Constants.LOT_OK)
                .build();
        LotEntity savedLot = lotRepository.save(lot);

        InventoryTransactionEntity txn = InventoryTransactionEntity.builder()
                .txnNo(numberGenerator.next(Prefix.INVENTORY_TXN, 4))
                .item(purchaseOrder.getItem())
                .lot(savedLot)
                .warehouse(Constants.WAREHOUSE_MATERIAL)
                .txnType(Constants.TXN_RECEIVE)
                .qty(goodQty)
                .refType("RECEIVING")
                .refNo(savedReceiving.getReceivingNo())
                .txnDate(savedReceiving.getReceivedDate())
                .build();
        InventoryTransactionEntity savedTxn = inventoryTransactionRepository.save(txn);

        auditService.record("CREATE", "RECEIVING", savedReceiving.getReceivingNo(),
                toResponse(savedReceiving));
        auditService.record("CREATE", "LOT", savedLot.getLotNo(), null);
        CreateResult result = CreateResult.builder()
                .receiving(toResponse(savedReceiving))
                .lotNo(savedLot.getLotNo())
                .inventoryTxnNo(savedTxn.getTxnNo())
                .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @Operation(summary = "입고 이력 삭제")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MATERIAL')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ReceivingEntity entity = receivingRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND,
                        "입고를 찾을 수 없습니다: " + id));
        receivingRepository.delete(entity);
        auditService.record("DELETE", "RECEIVING", entity.getReceivingNo(), null);
        return ResponseEntity.noContent().build();
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
                .build();
    }
}
