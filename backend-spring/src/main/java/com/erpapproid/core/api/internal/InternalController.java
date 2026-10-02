package com.erpapproid.core.api.internal;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.internal.InternalDto.BomRow;
import com.erpapproid.core.api.internal.InternalDto.ItemRow;
import com.erpapproid.core.api.internal.InternalDto.StockRow;
import com.erpapproid.core.api.internal.InternalDto.WorkOrderRow;
import com.erpapproid.core.domain.bom.BomEntity;
import com.erpapproid.core.domain.bom.BomRepository;
import com.erpapproid.core.domain.inventory.InventoryTransactionRepository;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.production.WorkOrderEntity;
import com.erpapproid.core.domain.production.WorkOrderRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 * FastAPI → Spring 내부 호출. api-spec.md 9.
 * X-Internal-Key 인증은 InternalKeyFilter 가 담당한다.
 */
@Tag(name = "internal", description = "내부 전용 (FastAPI ↔ Spring)")
@RestController
@RequestMapping("/api/core/internal")
@RequiredArgsConstructor
public class InternalController {

    private final ItemRepository itemRepository;
    private final BomRepository bomRepository;
    private final WorkOrderRepository workOrderRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;

    @Operation(summary = "품목 전체 (캐시 동기화용)")
    @GetMapping("/items")
    public ResponseEntity<List<ItemRow>> items() {
        return ResponseEntity.ok(itemRepository.findAll().stream().map(this::toItemRow).toList());
    }

    @Operation(summary = "현재고 전체")
    @GetMapping("/inventory/stock")
    public ResponseEntity<List<StockRow>> stock() {
        return ResponseEntity.ok(itemRepository.findAll().stream().map(this::toStockRow).toList());
    }

    @Operation(summary = "진행중/지시 작업오더")
    @GetMapping("/work-orders/active")
    public ResponseEntity<List<WorkOrderRow>> activeWorkOrders() {
        return ResponseEntity.ok(workOrderRepository.findActive().stream()
                .map(this::toWorkOrderRow).toList());
    }

    @Operation(summary = "BOM 전개용")
    @GetMapping("/boms")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<BomRow>> boms() {
        return ResponseEntity.ok(bomRepository.findAll().stream().map(this::toBomRow).toList());
    }

    private ItemRow toItemRow(ItemEntity item) {
        return ItemRow.builder()
                .id(item.getId())
                .itemNo(item.getItemNo())
                .name(item.getName())
                .itemType(item.getItemType())
                .unit(item.getUnit())
                .price(item.getPrice())
                .safetyStock(item.getSafetyStock())
                .leadTimeDays(item.getLeadTimeDays())
                .build();
    }

    private StockRow toStockRow(ItemEntity item) {
        BigDecimal sum = inventoryTransactionRepository.sumQtyByItemId(item.getId());
        return StockRow.builder()
                .itemId(item.getId())
                .itemNo(item.getItemNo())
                .onHand(sum == null ? BigDecimal.ZERO : sum)
                .safetyStock(item.getSafetyStock())
                .build();
    }

    private WorkOrderRow toWorkOrderRow(WorkOrderEntity entity) {
        return WorkOrderRow.builder()
                .id(entity.getId())
                .workOrderNo(entity.getWorkOrderNo())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .qty(entity.getQty())
                .goodQty(entity.getGoodQty())
                .dueDate(entity.getDueDate())
                .status(entity.getStatus())
                .build();
    }

    private BomRow toBomRow(BomEntity entity) {
        return BomRow.builder()
                .id(entity.getId())
                .parentId(entity.getParent().getId())
                .parentItemNo(entity.getParent().getItemNo())
                .childId(entity.getChild().getId())
                .childItemNo(entity.getChild().getItemNo())
                .qty(entity.getQty())
                .lossRate(entity.getLossRate())
                .substituteNo(entity.getSubstituteNo())
                .build();
    }
}
