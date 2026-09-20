package com.erpapproid.core.api.production;

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

import com.erpapproid.core.api.production.WorkOrderDto.CompleteRequest;
import com.erpapproid.core.api.production.WorkOrderDto.CompleteResult;
import com.erpapproid.core.api.production.WorkOrderDto.Request;
import com.erpapproid.core.api.production.WorkOrderDto.Response;
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
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.production.WorkOrderEntity;
import com.erpapproid.core.domain.production.WorkOrderRepository;
import com.erpapproid.core.domain.sales.SalesOrderEntity;
import com.erpapproid.core.domain.sales.SalesOrderRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "work-orders", description = "작업오더")
@RestController
@RequestMapping("/api/core/work-orders")
@RequiredArgsConstructor
public class WorkOrderController {

    private final WorkOrderRepository workOrderRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final ItemRepository itemRepository;
    private final LotRepository lotRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;
    private final DomainNumberGenerator numberGenerator;
    private final AuditService auditService;

    @Operation(summary = "작업오더 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                workOrderRepository.search(status, itemId, keyword, pageable).map(this::toResponse));
    }

    @Operation(summary = "작업오더 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(workOrderRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "작업오더 생성 (독립)")
    @PostMapping
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        SalesOrderEntity salesOrder = null;
        if (request.getSalesOrderId() != null) {
            salesOrder = salesOrderRepository.findById(request.getSalesOrderId())
                    .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                            "수주를 찾을 수 없습니다: " + request.getSalesOrderId()));
        }
        WorkOrderEntity entity = WorkOrderEntity.builder()
                .workOrderNo(request.getWorkOrderNo())
                .salesOrder(salesOrder)
                .item(item)
                .qty(request.getQty())
                .goodQty(BigDecimal.ZERO)
                .defectQty(BigDecimal.ZERO)
                .progress(BigDecimal.ZERO)
                .startDate(request.getStartDate() == null ? LocalDate.now() : request.getStartDate())
                .dueDate(request.getDueDate())
                .status(Constants.WO_OPEN)
                .build();
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record("CREATE", "WORK_ORDER", saved.getWorkOrderNo(), toResponse(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "진척 업데이트")
    @PostMapping("/{id}/progress")
    @PreAuthorize("hasRole('PRODUCTION')")
    public ResponseEntity<Response> progress(@PathVariable Long id,
                                             @Valid @RequestBody CompleteRequest request) {
        WorkOrderEntity entity = workOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (Constants.WO_DONE.equals(entity.getStatus())
                || Constants.WO_CLOSED.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "완료/마감된 작업오더는 진척을 업데이트할 수 없습니다: " + entity.getWorkOrderNo());
        }
        Response before = toResponse(entity);
        applyActuals(entity, request);
        if (entity.getStatus().equals(Constants.WO_OPEN)) {
            entity.setStatus(Constants.WO_PROGRESS);
        }
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record("PROGRESS", "WORK_ORDER", saved.getWorkOrderNo(), before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "흐름 4: 작업오더 완료 → Lot/생산입고")
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<CompleteResult> complete(@PathVariable Long id,
                                                   @Valid @RequestBody(required = false)
                                                   CompleteRequest request) {
        WorkOrderEntity entity = workOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (Constants.WO_DONE.equals(entity.getStatus())
                || Constants.WO_CLOSED.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "이미 완료된 작업오더입니다: " + entity.getWorkOrderNo());
        }
        if (request != null) {
            applyActuals(entity, request);
        }
        if (entity.getGoodQty() == null || entity.getGoodQty().compareTo(BigDecimal.ZERO) <= 0) {
            throw new DomainException(ErrorCode.GOOD_QTY_ZERO,
                    "양품 수량이 0건인 작업오더는 완료할 수 없습니다: " + entity.getWorkOrderNo());
        }

        entity.setStatus(Constants.WO_DONE);
        entity.setProgress(BigDecimal.valueOf(100));
        WorkOrderEntity saved = workOrderRepository.save(entity);

        ItemEntity item = entity.getItem();
        String warehouse = warehouseFor(item);
        LotEntity lot = LotEntity.builder()
                .lotNo(numberGenerator.next(Prefix.LOT))
                .item(item)
                .warehouse(warehouse)
                .qty(entity.getGoodQty())
                .producedAt(LocalDate.now())
                .expiry(LocalDate.of(9999, 12, 31))
                .status(Constants.LOT_OK)
                .build();
        LotEntity savedLot = lotRepository.save(lot);

        InventoryTransactionEntity txn = InventoryTransactionEntity.builder()
                .txnNo(numberGenerator.next(Prefix.INVENTORY_TXN, 4))
                .item(item)
                .lot(savedLot)
                .warehouse(warehouse)
                .txnType(Constants.TXN_PRODUCTION_RECEIVE)
                .qty(entity.getGoodQty())
                .refType("WORK_ORDER")
                .refNo(saved.getWorkOrderNo())
                .txnDate(LocalDate.now())
                .build();
        InventoryTransactionEntity savedTxn = inventoryTransactionRepository.save(txn);

        auditService.record("COMPLETE", "WORK_ORDER", saved.getWorkOrderNo(), toResponse(saved));
        auditService.record("CREATE", "LOT", savedLot.getLotNo(), null);
        return ResponseEntity.ok(CompleteResult.builder()
                .workOrder(toResponse(saved))
                .lotNo(savedLot.getLotNo())
                .inventoryTxnNo(savedTxn.getTxnNo())
                .build());
    }

    @Operation(summary = "작업오더 마감 (완료 → 마감)")
    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    public ResponseEntity<Response> close(@PathVariable Long id) {
        WorkOrderEntity entity = workOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (!Constants.WO_DONE.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "완료 상태의 작업오더만 마감할 수 있습니다: " + entity.getWorkOrderNo());
        }
        entity.setStatus(Constants.WO_CLOSED);
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record("CLOSE", "WORK_ORDER", saved.getWorkOrderNo(), toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "작업오더 수정 (지시만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('PRODUCTION')")
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        WorkOrderEntity entity = workOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (!Constants.WO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "지시 상태의 작업오더만 수정할 수 있습니다: " + entity.getWorkOrderNo());
        }
        Response before = toResponse(entity);
        if (request.getQty() != null) {
            entity.setQty(request.getQty());
        }
        if (request.getStartDate() != null) {
            entity.setStartDate(request.getStartDate());
        }
        if (request.getDueDate() != null) {
            entity.setDueDate(request.getDueDate());
        }
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record("UPDATE", "WORK_ORDER", saved.getWorkOrderNo(), before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "작업오더 삭제 (지시만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('PRODUCTION')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        WorkOrderEntity entity = workOrderRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (!Constants.WO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "지시 상태의 작업오더만 삭제할 수 있습니다: " + entity.getWorkOrderNo());
        }
        workOrderRepository.delete(entity);
        auditService.record("DELETE", "WORK_ORDER", entity.getWorkOrderNo(), null);
        return ResponseEntity.noContent().build();
    }

    private void applyActuals(WorkOrderEntity entity, CompleteRequest request) {
        if (request.getGoodQty() != null) {
            entity.setGoodQty(request.getGoodQty());
        }
        if (request.getDefectQty() != null) {
            entity.setDefectQty(request.getDefectQty());
        }
        BigDecimal qty = entity.getQty() == null ? BigDecimal.ZERO : entity.getQty();
        if (qty.compareTo(BigDecimal.ZERO) > 0) {
            entity.setProgress(entity.getGoodQty()
                    .divide(qty, 2, java.math.RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)));
        }
    }

    private String warehouseFor(ItemEntity item) {
        return switch (item.getItemType()) {
            case Constants.PRODUCT -> Constants.WAREHOUSE_PRODUCT;
            case Constants.SEMI -> Constants.WAREHOUSE_SEMI;
            default -> Constants.WAREHOUSE_MATERIAL;
        };
    }

    private Response toResponse(WorkOrderEntity entity) {
        boolean delayed = !Constants.WO_DONE.equals(entity.getStatus())
                && !Constants.WO_CLOSED.equals(entity.getStatus())
                && entity.getDueDate() != null
                && entity.getDueDate().isBefore(LocalDate.now());
        return Response.builder()
                .id(entity.getId())
                .workOrderNo(entity.getWorkOrderNo())
                .salesOrderId(entity.getSalesOrder() == null ? null : entity.getSalesOrder().getId())
                .salesOrderNo(entity.getSalesOrder() == null
                        ? null : entity.getSalesOrder().getSalesOrderNo())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .qty(entity.getQty())
                .goodQty(entity.getGoodQty())
                .defectQty(entity.getDefectQty())
                .progress(entity.getProgress())
                .startDate(entity.getStartDate())
                .dueDate(entity.getDueDate())
                .status(entity.getStatus())
                .delayed(delayed)
                .build();
    }
}
