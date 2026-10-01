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
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.production.ProductionPlanEntity;
import com.erpapproid.core.domain.production.ProductionPlanRepository;

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
        auditService.record(AuditEvent.created(
                "PRODUCTION_PLAN", saved.getPlanNo(), toResponse(saved)));
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
