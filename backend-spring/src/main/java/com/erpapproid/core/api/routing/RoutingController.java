package com.erpapproid.core.api.routing;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    @Operation(summary = "공정 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Response>> list(@RequestParam(required = false) Long itemId) {
        List<RoutingEntity> rows = itemId != null
                ? routingRepository.findByItemId(itemId)
                : routingRepository.findAll();
        return ResponseEntity.ok(rows.stream().map(this::toResponse).toList());
    }

    @Operation(summary = "공정 생성")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PRODUCTION')")
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
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
        auditService.record("CREATE", "ROUTING", saved.getRoutingNo(), toResponse(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "공정 수정")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRODUCTION')")
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        RoutingEntity entity = routingRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.ROUTING_NOT_FOUND,
                        "공정을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        if (request.getSeq() != null) {
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
        auditService.record("UPDATE", "ROUTING", saved.getRoutingNo(), before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "공정 삭제")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        RoutingEntity entity = routingRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.ROUTING_NOT_FOUND,
                        "공정을 찾을 수 없습니다: " + id));
        routingRepository.delete(entity);
        auditService.record("DELETE", "ROUTING", entity.getRoutingNo(), null);
        return ResponseEntity.noContent().build();
    }

    private Response toResponse(RoutingEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .routingNo(entity.getRoutingNo())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .seq(entity.getSeq())
                .process(entity.getProcess())
                .workCenter(entity.getWorkCenter())
                .stdTime(entity.getStdTime())
                .isSubcontract(entity.getIsSubcontract())
                .build();
    }
}
