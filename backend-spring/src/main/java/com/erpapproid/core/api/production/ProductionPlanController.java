package com.erpapproid.core.api.production;

import java.math.BigDecimal;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.production.ProductionPlanDto.Request;
import com.erpapproid.core.api.production.ProductionPlanDto.Response;
import com.erpapproid.core.api.production.ProductionPlanDto.SuggestedOrder;
import com.erpapproid.core.api.production.ProductionPlanDto.Suggestion;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.production.ProductionPlanEntity;
import com.erpapproid.core.domain.production.ProductionPlanRepository;
import com.erpapproid.core.domain.sales.SalesOrderRepository;
import com.erpapproid.core.domain.sales.ShipmentRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "production-plans", description = "생산계획")
@RestController
@RequestMapping("/api/core/production-plans")
@RequiredArgsConstructor
public class ProductionPlanController {

    private final ProductionPlanRepository planRepository;
    private final ItemRepository itemRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final ShipmentRepository shipmentRepository;
    private final AuditService auditService;

    @Operation(summary = "생산계획 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String planMonth,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                planRepository.search(planMonth, status, pageable).map(this::toResponse));
    }

    @Operation(summary = "생산계획 수량 산출 제안: 수주잔량·현재고 근거")
    @GetMapping("/suggest")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Suggestion> suggest(
            @RequestParam Long itemId,
            @RequestParam String planMonth) {
        if (itemId == null || itemId <= 0 || planMonth == null
                || !planMonth.matches("\\d{4}-(0[1-9]|1[0-2])")) {
            throw new DomainException(ErrorCode.INVALID_INPUT,
                    "품목 ID와 계획월(YYYY-MM)이 필요합니다.");
        }
        ItemEntity item = itemRepository.findById(itemId)
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + itemId));
        java.time.LocalDate cutoff = java.time.YearMonth.parse(planMonth).atEndOfMonth();
        var openOrders = salesOrderRepository.findByItem_IdAndStatusInAndDueDateLessThanEqualOrderByDueDateAscIdAsc(
                itemId, java.util.List.of(Constants.CONFIRMED, Constants.IN_PRODUCTION), cutoff);
        if (openOrders.size() > 10000) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION,
                    "산출 대상 수주 규모 한도를 초과했습니다. 일부 데이터만으로 계산하지 않습니다.");
        }
        var rows = new java.util.ArrayList<SuggestedOrder>();
        BigDecimal backlog = BigDecimal.ZERO;
        for (var order : openOrders) {
            BigDecimal shipped = shipmentRepository.confirmedQty(order.getId());
            BigDecimal remaining = order.getQty().subtract(shipped).max(BigDecimal.ZERO);
            backlog = backlog.add(remaining);
            rows.add(SuggestedOrder.builder()
                    .orderId(order.getId())
                    .salesOrderNo(order.getSalesOrderNo())
                    .dueDate(order.getDueDate())
                    .orderQty(order.getQty())
                    .shippedQty(shipped)
                    .remainingQty(remaining)
                    .build());
        }
        BigDecimal stock = item.getStock() == null ? BigDecimal.ZERO : item.getStock();
        BigDecimal safety = item.getSafetyStock() == null ? BigDecimal.ZERO : item.getSafetyStock();
        BigDecimal suggested = backlog.add(safety).subtract(stock).max(BigDecimal.ZERO);
        return ResponseEntity.ok(Suggestion.builder()
                .itemId(item.getId())
                .itemNo(item.getItemNo())
                .itemName(item.getName())
                .planMonth(planMonth)
                .dueCutoff(cutoff)
                .orderBacklogQty(backlog)
                .currentStock(stock)
                .safetyStock(safety)
                .suggestedPlanQty(suggested)
                .suggestedGapQty(suggested)
                .openOrderCount(rows.size())
                .orders(java.util.List.copyOf(rows))
                .notes(java.util.List.of(
                        "대상은 납기가 계획월 말일(" + cutoff + ") 이전인 확정/생산중 수주이며 출하완료·매출반영 출하량을 차감합니다. 대기·취소·출하완료 수주와 이후 납기 수주는 제외합니다.",
                        "제안식: max(수주잔량 " + backlog + " + 안전재고 " + safety + " - 현재고 " + stock + ", 0). 생산필요량은 순생산필요량과 동일하게 두어 이중 차감을 피합니다.",
                        "제안은 예약이 아니므로 계획 등록 전 재조회하세요. 산출 근거는 등록 시 basisNote로 감사 기록에 남길 수 있습니다."))
                .build());
    }

    @Operation(summary = "생산계획 생성")
    @PostMapping
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        if (planRepository.existsByItemIdAndPlanMonth(request.getItemId(), request.getPlanMonth())) {
            throw new DomainException(ErrorCode.PLAN_DUPLICATE,
                    "이미 등록된 계획입니다. 품목: " + item.getItemNo() + ", 월: " + request.getPlanMonth());
        }
        ProductionPlanEntity entity = ProductionPlanEntity.builder()
                .planNo(request.getPlanNo())
                .item(item)
                .planMonth(request.getPlanMonth())
                .planQty(request.getPlanQty())
                .orderQty(request.getOrderQty() == null ? BigDecimal.ZERO : request.getOrderQty())
                .stockQty(request.getStockQty() == null ? BigDecimal.ZERO : request.getStockQty())
                .gapQty(request.getGapQty() == null ? BigDecimal.ZERO : request.getGapQty())
                .status(Constants.PLAN_DRAFT)
                .build();
        ProductionPlanEntity saved = planRepository.save(entity);
        Response response = toResponse(saved);
        Object after = request.getBasisNote() == null || request.getBasisNote().isBlank() ? response
                : java.util.Map.of("plan", response, "basisNote", request.getBasisNote().strip());
        auditService.record(AuditEvent.created(
                "PRODUCTION_PLAN", saved.getPlanNo(), after));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "생산계획 수정")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        ProductionPlanEntity entity = planRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND,
                        "생산계획을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        if (request.getPlanQty() != null) {
            entity.setPlanQty(request.getPlanQty());
        }
        if (request.getOrderQty() != null) {
            entity.setOrderQty(request.getOrderQty());
        }
        if (request.getStockQty() != null) {
            entity.setStockQty(request.getStockQty());
        }
        if (request.getGapQty() != null) {
            entity.setGapQty(request.getGapQty());
        }
        ProductionPlanEntity saved = planRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "UPDATE", "PRODUCTION_PLAN", saved.getPlanNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "생산계획 확정")
    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> confirm(@PathVariable Long id) {
        return transition(id, Constants.PLAN_CONFIRMED, "확정");
    }

    @Operation(summary = "생산계획 종결")
    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('PRODUCTION', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> close(@PathVariable Long id) {
        return transition(id, Constants.PLAN_CLOSED, "종결");
    }

    private ResponseEntity<Response> transition(Long id, String to, String label) {
        ProductionPlanEntity entity = planRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND,
                        "생산계획을 찾을 수 없습니다: " + id));
        String from = entity.getStatus();
        boolean allowed = Constants.PLAN_DRAFT.equals(from) && Constants.PLAN_CONFIRMED.equals(to)
                || Constants.PLAN_CONFIRMED.equals(from) && Constants.PLAN_CLOSED.equals(to);
        if (!allowed) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "생산계획 상태를 " + from + " → " + to + " 로 전이할 수 없습니다.");
        }
        Response before = toResponse(entity);
        entity.setStatus(to);
        ProductionPlanEntity saved = planRepository.save(entity);
        auditService.record(AuditEvent.changed(label.toUpperCase(), "PRODUCTION_PLAN",
                saved.getPlanNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    private Response toResponse(ProductionPlanEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .planNo(entity.getPlanNo())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .planMonth(entity.getPlanMonth())
                .planQty(entity.getPlanQty())
                .orderQty(entity.getOrderQty())
                .stockQty(entity.getStockQty())
                .gapQty(entity.getGapQty())
                .status(entity.getStatus())
                .build();
    }
}
