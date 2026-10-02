package com.erpapproid.core.api.routing;

import java.math.BigDecimal;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.api.routing.RoutingDto.UpdateRequest;
import com.erpapproid.core.domain.production.WorkOrderRepository;

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

import com.erpapproid.core.api.routing.RoutingDto.Request;
import com.erpapproid.core.api.routing.RoutingDto.Response;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.routing.RoutingEntity;
import com.erpapproid.core.domain.routing.RoutingRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "routings", description = "공정")
@RestController
@RequestMapping("/api/core/routings")
@RequiredArgsConstructor
public class RoutingController {

    private final RoutingRepository routingRepository;
    private final ItemRepository itemRepository;
    private final AuditService auditService;
    private final WorkOrderRepository workOrderRepository;

    @Operation(summary = "공정 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "routingNo,asc") String sort) {
        MasterListQuery.positiveId(itemId);
        String pattern = MasterListQuery.keyword(keyword);
        var pageable = MasterListQuery.pageable(page, size, sort,
                Set.of("routingNo", "item.itemNo", "seq", "process", "workCenter", "stdTime", "isSubcontract"), "routingNo");
        Specification<RoutingEntity> spec = (root, query, cb) -> {
            var item = root.join("item");
            var filter = itemId == null ? cb.conjunction() : cb.equal(item.get("id"), itemId);
            if (pattern == null) return filter;
            return cb.and(filter, cb.or(cb.like(cb.lower(root.get("routingNo")), pattern, '!'),
                    cb.like(cb.lower(item.get("itemNo")), pattern, '!'),
                    cb.like(cb.lower(item.get("name")), pattern, '!'),
                    cb.like(cb.lower(root.get("process")), pattern, '!'),
                    cb.like(cb.lower(root.get("workCenter")), pattern, '!')));
        };
        return ResponseEntity.ok(routingRepository.findAll(spec, pageable).map(this::toResponse));
    }

    @Operation(summary = "공정 생성")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PRODUCTION')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        if ("자재".equals(item.getItemType())) {
            throw new DomainException(ErrorCode.ITEM_NOT_PRODUCIBLE, "공정은 제품 또는 반제품에 등록할 수 있습니다.");
        }
        if (routingRepository.existsByRoutingNo(request.getRoutingNo())) {
            throw new DomainException(ErrorCode.ROUTING_NO_DUPLICATE, "이미 등록된 공정 번호입니다.");
        }
        if (routingRepository.existsByItemIdAndSeq(request.getItemId(), request.getSeq())) {
            throw new DomainException(ErrorCode.ROUTING_SEQ_DUPLICATE,
                    "이미 등록된 공정 순서입니다: " + request.getSeq());
        }
        RoutingEntity entity = RoutingEntity.builder()
                .routingNo(request.getRoutingNo())
                .item(item)
                .seq(request.getSeq())
                .process(request.getProcess())
                .workCenter(request.getWorkCenter())
                .stdTime(request.getStdTime() == null ? BigDecimal.ZERO : request.getStdTime())
                .isSubcontract(request.getIsSubcontract() != null && request.getIsSubcontract())
                .build();
        RoutingEntity saved = routingRepository.save(entity);
        auditService.record(AuditEvent.created("ROUTING", saved.getRoutingNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "공정 수정")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRODUCTION')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) throw MasterListQuery.invalid("수정할 공정 필드가 필요합니다.");
        RoutingEntity entity = routingRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.ROUTING_NOT_FOUND,
                        "공정을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        if (request.getSeq() != null) {
            if (routingRepository.existsByItemIdAndSeqAndIdNot(entity.getItem().getId(), request.getSeq(), id)) {
                throw new DomainException(ErrorCode.ROUTING_SEQ_DUPLICATE, "이미 등록된 공정 순서입니다.");
            }
            entity.setSeq(request.getSeq());
        }
        if (request.getProcess() != null) {
            entity.setProcess(request.getProcess());
        }
        if (request.getWorkCenter() != null) {
            entity.setWorkCenter(request.getWorkCenter());
        }
        if (request.getStdTime() != null) {
            entity.setStdTime(request.getStdTime());
        }
        if (request.getIsSubcontract() != null) {
            entity.setIsSubcontract(request.getIsSubcontract());
        }
        RoutingEntity saved = routingRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "UPDATE", "ROUTING", saved.getRoutingNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "공정 삭제")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        RoutingEntity entity = routingRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.ROUTING_NOT_FOUND,
                        "공정을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        if (workOrderRepository.referencesRouting(id)) {
            throw new DomainException(ErrorCode.ROUTING_IN_USE, "작업오더에서 참조 중인 공정은 삭제할 수 없습니다.");
        }
        routingRepository.delete(entity);
        auditService.record(AuditEvent.deleted("ROUTING", entity.getRoutingNo(), before));
        return ResponseEntity.noContent().build();
    }

    private Response toResponse(RoutingEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .routingNo(entity.getRoutingNo())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .seq(entity.getSeq())
                .process(entity.getProcess())
                .workCenter(entity.getWorkCenter())
                .stdTime(entity.getStdTime())
                .isSubcontract(entity.getIsSubcontract())
                .build();
    }
}
