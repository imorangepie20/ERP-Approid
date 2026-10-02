package com.erpapproid.core.api.production;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.math.RoundingMode;
import java.util.Set;
import java.util.ArrayList;

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

import com.erpapproid.core.api.production.WorkOrderDto.CompleteRequest;
import com.erpapproid.core.api.production.WorkOrderDto.CompleteResult;
import com.erpapproid.core.api.production.WorkOrderDto.Request;
import com.erpapproid.core.api.production.WorkOrderDto.Response;
import com.erpapproid.core.api.production.WorkOrderDto.UpdateRequest;
import com.erpapproid.core.common.api.MasterListQuery;
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
    private final com.erpapproid.core.domain.production.RoutingSnapshotService routingSnapshots;

    @Operation(summary = "작업오더 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) Long salesOrderId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "workOrderNo,desc") String sort) {
        var pageable = MasterListQuery.pageable(page, size, sort,
                Set.of("workOrderNo", "item.itemNo", "qty", "goodQty", "defectQty", "progress", "startDate", "dueDate", "status", "assignee", "priority"), "workOrderNo");
        MasterListQuery.positiveId(itemId);
        if (salesOrderId != null && salesOrderId <= 0) throw MasterListQuery.invalid("수주 ID는 양수여야 합니다.");
        String selected = status == null || status.isBlank() ? null : status;
        if (selected != null && !Set.of(Constants.WO_OPEN, Constants.WO_PROGRESS, Constants.WO_DONE, Constants.WO_CLOSED, Constants.WO_CANCEL).contains(selected)) {
            throw MasterListQuery.invalid("지원하지 않는 상태입니다.");
        }
        String pattern = MasterListQuery.keyword(keyword);
        org.springframework.data.jpa.domain.Specification<WorkOrderEntity> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (selected != null) predicates.add(cb.equal(root.get("status"), selected));
            if (itemId != null) predicates.add(cb.equal(root.get("item").get("id"), itemId));
            if (salesOrderId != null) predicates.add(cb.equal(root.get("salesOrder").get("id"), salesOrderId));
            if (pattern != null) {
                var item = root.join("item");
                var order = root.join("salesOrder", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(cb.or(cb.like(cb.lower(root.get("workOrderNo")), pattern, '!'),
                        cb.like(cb.lower(item.get("itemNo")), pattern, '!'), cb.like(cb.lower(item.get("name")), pattern, '!'),
                        cb.like(cb.lower(order.get("salesOrderNo")), pattern, '!'), cb.like(cb.lower(root.get("assignee")), pattern, '!')));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return ResponseEntity.ok(
                workOrderRepository.findAll(spec, pageable).map(this::toResponse));
    }

    @Operation(summary = "작업오더 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(workOrderRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "작업오더 생성 (독립)")
    @PostMapping
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        if (request.getSalesOrderId() != null) throw MasterListQuery.invalid("수주 연결 작업오더는 수주 확정에서 생성하세요.");
        if (workOrderRepository.existsByWorkOrderNo(request.getWorkOrderNo())) {
            throw new DomainException(ErrorCode.WORK_ORDER_NO_DUPLICATE, "이미 사용 중인 작업오더 번호입니다.");
        }
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        if (!Set.of(Constants.PRODUCT, Constants.SEMI).contains(item.getItemType())) {
            throw new DomainException(ErrorCode.ITEM_NOT_PRODUCIBLE, "제품/반제품만 작업오더를 생성할 수 있습니다.");
        }
        WorkOrderEntity entity = WorkOrderEntity.builder()
                .workOrderNo(request.getWorkOrderNo())
                .item(item)
                .qty(request.getQty())
                .goodQty(BigDecimal.ZERO)
                .defectQty(BigDecimal.ZERO)
                .progress(BigDecimal.ZERO)
                .startDate(request.getStartDate() == null ? today() : request.getStartDate())
                .dueDate(request.getDueDate())
                .status(Constants.WO_OPEN)
                .routingSteps(routingSnapshots.capture(item.getId()))
                .assignee(request.getAssignee() == null ? "" : request.getAssignee())
                .priority(request.getPriority() == null ? 1 : request.getPriority())
                .build();
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record(AuditEvent.created(
                "WORK_ORDER", saved.getWorkOrderNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "진척 업데이트")
    @PostMapping("/{id}/progress")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> progress(@PathVariable Long id,
                                             @Valid @RequestBody CompleteRequest request) {
        if (!request.hasChanges()) throw MasterListQuery.invalid("누적 실적을 입력하세요.");
        WorkOrderEntity entity = workOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        requireActive(entity);
        Response before = toResponse(entity);
        applyActuals(entity, request);
        if (entity.getStatus().equals(Constants.WO_OPEN)) {
            entity.setStatus(Constants.WO_PROGRESS);
        }
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "PROGRESS", "WORK_ORDER", saved.getWorkOrderNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "흐름 4: 작업오더 완료 → Lot/생산입고")
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<CompleteResult> complete(@PathVariable Long id,
                                                   @Valid @RequestBody(required = false)
                                                   CompleteRequest request) {
        WorkOrderEntity entity = workOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        requireActive(entity);
        ItemEntity item = itemRepository.findForUpdate(entity.getItem().getId()).orElseThrow();
        Response before = toResponse(entity);
        if (request != null) {
            applyActuals(entity, request);
        }
        if (entity.getGoodQty() == null || entity.getGoodQty().compareTo(BigDecimal.ZERO) <= 0) {
            throw new DomainException(ErrorCode.GOOD_QTY_ZERO,
                    "양품 수량이 0건인 작업오더는 완료할 수 없습니다: " + entity.getWorkOrderNo());
        }
        if (entity.getGoodQty().add(entity.getDefectQty()).compareTo(entity.getQty()) != 0) {
            throw new DomainException(ErrorCode.WORK_ORDER_QTY_MISMATCH, "완료하려면 양품+불량 누적 합계가 지시수량과 같아야 합니다.");
        }
        BigDecimal stockBefore = item.getStock();
        BigDecimal stockAfter = stockBefore.add(entity.getGoodQty());
        if (stockAfter.compareTo(new BigDecimal("99999999999999.9999")) > 0) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "현재고가 저장 가능한 범위를 초과합니다.");
        }
        item.setStock(stockAfter);

        entity.setStatus(Constants.WO_DONE);
        entity.setProgress(BigDecimal.valueOf(100));
        WorkOrderEntity saved = workOrderRepository.save(entity);

        String warehouse = warehouseFor(item);
        LotEntity lot = LotEntity.builder()
                .lotNo(numberGenerator.next(Prefix.LOT))
                .item(item)
                .warehouse(warehouse)
                .qty(entity.getGoodQty())
                .producedAt(today())
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
                .txnDate(today())
                .build();
        InventoryTransactionEntity savedTxn = inventoryTransactionRepository.save(txn);

        auditService.record(AuditEvent.changed(
                "COMPLETE", "WORK_ORDER", saved.getWorkOrderNo(), before, toResponse(saved)));
        auditService.record(AuditEvent.created("LOT", savedLot.getLotNo(), lotSnapshot(savedLot)));
        auditService.record(AuditEvent.created(
                "INVENTORY_TRANSACTION", savedTxn.getTxnNo(), transactionSnapshot(savedTxn)));
        auditService.record(AuditEvent.changed("PRODUCTION_RECEIVE", "ITEM", item.getItemNo(),
                java.util.Map.of("id", item.getId(), "itemNo", item.getItemNo(), "stock", stockBefore),
                java.util.Map.of("id", item.getId(), "itemNo", item.getItemNo(), "stock", stockAfter)));
        return ResponseEntity.ok(CompleteResult.builder()
                .workOrder(toResponse(saved))
                .lotNo(savedLot.getLotNo())
                .inventoryTxnNo(savedTxn.getTxnNo())
                .build());
    }

    @Operation(summary = "작업오더 마감 (완료 → 마감)")
    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> close(@PathVariable Long id) {
        WorkOrderEntity entity = workOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (!Constants.WO_DONE.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "완료 상태의 작업오더만 마감할 수 있습니다: " + entity.getWorkOrderNo());
        }
        Response before = toResponse(entity);
        entity.setStatus(Constants.WO_CLOSED);
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "CLOSE", "WORK_ORDER", saved.getWorkOrderNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "작업오더 수정 (지시만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) throw MasterListQuery.invalid("수정할 값을 입력하세요.");
        WorkOrderEntity entity = workOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (!Constants.WO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "지시 상태의 작업오더만 수정할 수 있습니다: " + entity.getWorkOrderNo());
        }
        Response before = toResponse(entity);
        if (request.getQty() != null) {
            if (entity.getSalesOrder() != null && request.getQty().compareTo(entity.getQty()) != 0) {
                throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "수주 연결 작업오더의 지시수량은 변경할 수 없습니다.");
            }
            if (entity.getGoodQty().add(entity.getDefectQty()).compareTo(request.getQty()) > 0) {
                throw new DomainException(ErrorCode.WORK_ORDER_QTY_EXCEEDED, "지시수량은 누적 실적보다 작을 수 없습니다.");
            }
            entity.setQty(request.getQty());
        }
        if (request.getStartDate() != null) {
            entity.setStartDate(request.getStartDate());
        }
        if (request.getDueDate() != null) {
            entity.setDueDate(request.getDueDate());
        }
        if (request.getAssignee() != null) entity.setAssignee(request.getAssignee());
        if (request.getPriority() != null) entity.setPriority(request.getPriority());
        WorkOrderEntity saved = workOrderRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "UPDATE", "WORK_ORDER", saved.getWorkOrderNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "작업오더 삭제 (지시만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        WorkOrderEntity entity = workOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND,
                        "작업오더를 찾을 수 없습니다: " + id));
        if (!Constants.WO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "지시 상태의 작업오더만 삭제할 수 있습니다: " + entity.getWorkOrderNo());
        }
        Response before = toResponse(entity);
        requireIndependentAndNoActuals(entity);
        workOrderRepository.delete(entity);
        auditService.record(AuditEvent.deleted("WORK_ORDER", entity.getWorkOrderNo(), before));
        return ResponseEntity.noContent().build();
    }

    private void applyActuals(WorkOrderEntity entity, CompleteRequest request) {
        if (request.getGoodQty() != null) {
            entity.setGoodQty(request.getGoodQty());
        }
        if (request.getDefectQty() != null) {
            entity.setDefectQty(request.getDefectQty());
        }
        BigDecimal processed = entity.getGoodQty().add(entity.getDefectQty());
        if (processed.compareTo(entity.getQty()) > 0) {
            throw new DomainException(ErrorCode.WORK_ORDER_QTY_EXCEEDED, "양품+불량 누적 합계가 지시수량을 초과했습니다.");
        }
        entity.setProgress(processed.multiply(BigDecimal.valueOf(100)).divide(entity.getQty(), 2, RoundingMode.HALF_UP));
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
                && !Constants.WO_CANCEL.equals(entity.getStatus())
                && entity.getDueDate() != null
                && entity.getDueDate().isBefore(today());
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
                .routingSteps(entity.getRoutingSteps())
                .plannedTimeHours(entity.getRoutingSteps().stream()
                        .map(step -> step.stdTime()).reduce(BigDecimal.ZERO, BigDecimal::add).multiply(entity.getQty()))
                .subcontractTimeHours(entity.getRoutingSteps().stream().filter(step -> step.isSubcontract())
                        .map(step -> step.stdTime()).reduce(BigDecimal.ZERO, BigDecimal::add).multiply(entity.getQty()))
                .assignee(entity.getAssignee())
                .priority(entity.getPriority())
                .build();
    }

    @Operation(summary = "독립 작업오더 취소 (실적 없는 지시만)")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> cancel(@PathVariable Long id) {
        WorkOrderEntity entity = workOrderRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.WORK_ORDER_NOT_FOUND, "작업오더를 찾을 수 없습니다: " + id));
        if (!Constants.WO_OPEN.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION, "실적 없는 지시 상태의 독립 오더만 취소할 수 있습니다.");
        }
        requireIndependentAndNoActuals(entity);
        Response before = toResponse(entity);
        entity.setStatus(Constants.WO_CANCEL);
        auditService.record(AuditEvent.changed("CANCEL", "WORK_ORDER", entity.getWorkOrderNo(), before, toResponse(entity)));
        return ResponseEntity.ok(toResponse(entity));
    }

    private void requireActive(WorkOrderEntity entity) {
        if (!Set.of(Constants.WO_OPEN, Constants.WO_PROGRESS).contains(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION, "지시/진행중 작업오더만 실적 입력·완료할 수 있습니다.");
        }
    }

    private void requireIndependentAndNoActuals(WorkOrderEntity entity) {
        if (entity.getSalesOrder() != null || entity.getGoodQty().signum() != 0 || entity.getDefectQty().signum() != 0) {
            throw new DomainException(ErrorCode.IN_USE, "수주 연결 또는 실적이 있는 작업오더는 삭제/단순 취소할 수 없습니다.");
        }
    }

    private LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }

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
                "warehouse", entity.getWarehouse(),
                "type", entity.getTxnType(),
                "qty", entity.getQty());
    }
}
