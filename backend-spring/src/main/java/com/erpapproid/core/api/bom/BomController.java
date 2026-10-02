package com.erpapproid.core.api.bom;

import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.domain.bom.BomGraphService;
import com.erpapproid.core.api.bom.BomDto.UpdateRequest;

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

import com.erpapproid.core.api.bom.BomDto.Request;
import com.erpapproid.core.api.bom.BomDto.Response;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.bom.BomEntity;
import com.erpapproid.core.domain.bom.BomRepository;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "boms", description = "BOM")
@RestController
@RequestMapping("/api/core/boms")
@RequiredArgsConstructor
public class BomController {

    private final BomRepository bomRepository;
    private final ItemRepository itemRepository;
    private final AuditService auditService;
    private final BomGraphService graphService;

    @Operation(summary = "BOM 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) Long parentId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "bomNo,asc") String sort) {
        MasterListQuery.positiveId(parentId);
        String pattern = MasterListQuery.keyword(keyword);
        var pageable = MasterListQuery.pageable(page, size, sort,
                Set.of("bomNo", "parent.itemNo", "child.itemNo", "qty", "lossRate", "substituteNo"), "bomNo");
        Specification<BomEntity> spec = (root, query, cb) -> {
            var parent = root.join("parent");
            var child = root.join("child");
            var filter = parentId == null ? cb.conjunction() : cb.equal(parent.get("id"), parentId);
            if (pattern == null) return filter;
            return cb.and(filter, cb.or(
                    cb.like(cb.lower(root.get("bomNo")), pattern, '!'),
                    cb.like(cb.lower(parent.get("itemNo")), pattern, '!'),
                    cb.like(cb.lower(parent.get("name")), pattern, '!'),
                    cb.like(cb.lower(child.get("itemNo")), pattern, '!'),
                    cb.like(cb.lower(child.get("name")), pattern, '!')));
        };
        return ResponseEntity.ok(bomRepository.findAll(spec, pageable).map(this::toResponse));
    }

    @Operation(summary = "BOM 생성")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PRODUCTION')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        ItemEntity parent = itemRepository.findById(request.getParentId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "모품목을 찾을 수 없습니다: " + request.getParentId()));
        ItemEntity child = itemRepository.findById(request.getChildId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "자품목을 찾을 수 없습니다: " + request.getChildId()));
        graphService.validateEdge(parent.getId(), child.getId());
        if ("자재".equals(parent.getItemType())) {
            throw new DomainException(ErrorCode.ITEM_NOT_PRODUCIBLE, "모품목은 제품 또는 반제품이어야 합니다.");
        }
        if (bomRepository.existsByBomNo(request.getBomNo())
                || bomRepository.existsByParentIdAndChildId(request.getParentId(), request.getChildId())) {
            throw new DomainException(ErrorCode.BOM_DUPLICATE, "이미 등록된 BOM 조합입니다.");
        }
        BomEntity entity = BomEntity.builder()
                .bomNo(request.getBomNo())
                .parent(parent)
                .child(child)
                .qty(request.getQty())
                .lossRate(request.getLossRate() == null ? java.math.BigDecimal.ZERO
                        : request.getLossRate())
                .substituteNo(request.getSubstituteNo())
                .build();
        BomEntity saved = bomRepository.save(entity);
        auditService.record(AuditEvent.created("BOM", saved.getBomNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "BOM 수정")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRODUCTION')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) throw MasterListQuery.invalid("수정할 BOM 필드가 필요합니다.");
        BomEntity entity = bomRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.BOM_NOT_FOUND,
                        "BOM을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        if (request.getQty() != null) {
            entity.setQty(request.getQty());
        }
        if (request.getLossRate() != null) {
            entity.setLossRate(request.getLossRate());
        }
        if (request.getSubstituteNo() != null) {
            entity.setSubstituteNo(request.getSubstituteNo());
        }
        BomEntity saved = bomRepository.save(entity);
        auditService.record(AuditEvent.changed(
                "UPDATE", "BOM", saved.getBomNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "BOM 삭제")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        BomEntity entity = bomRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.BOM_NOT_FOUND,
                        "BOM을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        bomRepository.delete(entity);
        auditService.record(AuditEvent.deleted("BOM", entity.getBomNo(), before));
        return ResponseEntity.noContent().build();
    }

    private Response toResponse(BomEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .bomNo(entity.getBomNo())
                .parentId(entity.getParent().getId())
                .parentItemNo(entity.getParent().getItemNo())
                .parentName(entity.getParent().getName())
                .childId(entity.getChild().getId())
                .childItemNo(entity.getChild().getItemNo())
                .childName(entity.getChild().getName())
                .childType(entity.getChild().getItemType())
                .childUnit(entity.getChild().getUnit())
                .qty(entity.getQty())
                .lossRate(entity.getLossRate())
                .substituteNo(entity.getSubstituteNo())
                .build();
    }
}
