package com.erpapproid.core.api.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.inventory.InventoryDto.AdjustRequest;
import com.erpapproid.core.api.inventory.InventoryDto.AdjustResponse;
import com.erpapproid.core.api.inventory.InventoryDto.LowStockRow;
import com.erpapproid.core.api.inventory.InventoryDto.StockRow;
import com.erpapproid.core.api.inventory.InventoryDto.TxnRow;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.seq.DomainNumberGenerator;
import com.erpapproid.core.common.seq.DomainNumberGenerator.Prefix;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.inventory.InventoryTransactionEntity;
import com.erpapproid.core.domain.inventory.InventoryTransactionRepository;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "inventory", description = "재고")
@RestController
@RequestMapping("/api/core/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final ItemRepository itemRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;
    private final DomainNumberGenerator numberGenerator;
    private final AuditService auditService;

    @Operation(summary = "품목별 가용재고")
    @GetMapping("/stock")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<StockRow>> stock() {
        List<StockRow> rows = itemRepository.findAll().stream()
                .map(this::toStockRow)
                .toList();
        return ResponseEntity.ok(rows);
    }

    @Operation(summary = "안전재고 미달 목록")
    @GetMapping("/low-stock")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<LowStockRow>> lowStock() {
        List<LowStockRow> rows = itemRepository.findAll().stream()
                .filter(this::isLow)
                .map(this::toLowStockRow)
                .toList();
        return ResponseEntity.ok(rows);
    }

    @Operation(summary = "입출고 이력")
    @GetMapping("/transactions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<TxnRow>> transactions(
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) String txnType,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<InventoryTransactionEntity> page = inventoryTransactionRepository.search(
                itemId, txnType, from, to, pageable);
        return ResponseEntity.ok(page.map(this::toTxnRow));
    }

    @Operation(summary = "실사 조정: 실측 수량으로 현재고·수불 대사")
    @PostMapping("/adjustments")
    @PreAuthorize("hasAnyRole('MATERIAL', 'ADMIN')")
    @Transactional
    public ResponseEntity<AdjustResponse> adjust(@jakarta.validation.Valid @RequestBody AdjustRequest request) {
        ItemEntity item = itemRepository.findForUpdate(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        BigDecimal ledger = inventoryTransactionRepository.sumQtyByItemId(item.getId());
        if (ledger == null) {
            ledger = BigDecimal.ZERO;
        }
        BigDecimal delta = request.getCountedQty().subtract(ledger);
        if (delta.signum() == 0) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION,
                    "조정할 차이가 없습니다. 실측 수량이 수불 합계와 같습니다.");
        }
        BigDecimal before = item.getStock();
        item.setStock(request.getCountedQty());
        itemRepository.save(item);
        InventoryTransactionEntity txn = InventoryTransactionEntity.builder()
                .txnNo(numberGenerator.next(Prefix.INVENTORY_TXN, 4))
                .item(item)
                .warehouse(request.getWarehouse().strip())
                .txnType(Constants.TXN_ADJUST)
                .qty(delta)
                .refType("ADJUSTMENT")
                .txnDate(LocalDate.now())
                .build();
        InventoryTransactionEntity savedTxn = inventoryTransactionRepository.save(txn);
        AdjustResponse response = AdjustResponse.builder()
                .itemId(item.getId())
                .itemNo(item.getItemNo())
                .itemName(item.getName())
                .previousStock(before)
                .ledgerBalance(ledger)
                .countedQty(request.getCountedQty())
                .adjustedQty(delta)
                .txnNo(savedTxn.getTxnNo())
                .txnType(savedTxn.getTxnType())
                .txnDate(savedTxn.getTxnDate())
                .build();
        auditService.record(AuditEvent.changed("ADJUST", "ITEM", item.getItemNo(),
                java.util.Map.of("stock", before, "reason", request.getReason().strip()), response));
        auditService.record(AuditEvent.created("INVENTORY_TRANSACTION", savedTxn.getTxnNo(),
                java.util.Map.of(
                        "txnNo", savedTxn.getTxnNo(),
                        "itemId", item.getId(),
                        "qty", savedTxn.getQty(),
                        "type", savedTxn.getTxnType())));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private boolean isLow(ItemEntity item) {
        BigDecimal available = available(item);
        return available.compareTo(item.getSafetyStock()) < 0;
    }

    private BigDecimal available(ItemEntity item) {
        BigDecimal sum = inventoryTransactionRepository.sumQtyByItemId(item.getId());
        return sum == null ? BigDecimal.ZERO : sum;
    }

    private StockRow toStockRow(ItemEntity item) {
        BigDecimal available = available(item);
        return StockRow.builder()
                .itemId(item.getId())
                .itemNo(item.getItemNo())
                .itemName(item.getName())
                .itemType(item.getItemType())
                .unit(item.getUnit())
                .stock(available)
                .safetyStock(item.getSafetyStock())
                .lowStock(isLow(item))
                .leadTimeDays(item.getLeadTimeDays())
                .build();
    }

    private LowStockRow toLowStockRow(ItemEntity item) {
        BigDecimal available = available(item);
        return LowStockRow.builder()
                .itemId(item.getId())
                .itemNo(item.getItemNo())
                .itemName(item.getName())
                .unit(item.getUnit())
                .stock(available)
                .safetyStock(item.getSafetyStock())
                .shortfall(item.getSafetyStock().subtract(available))
                .build();
    }

    private TxnRow toTxnRow(InventoryTransactionEntity entity) {
        return TxnRow.builder()
                .id(entity.getId())
                .txnNo(entity.getTxnNo())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .warehouse(entity.getWarehouse())
                .txnType(entity.getTxnType())
                .qty(entity.getQty())
                .refType(entity.getRefType())
                .refNo(entity.getRefNo())
                .txnDate(entity.getTxnDate())
                .build();
    }
}
