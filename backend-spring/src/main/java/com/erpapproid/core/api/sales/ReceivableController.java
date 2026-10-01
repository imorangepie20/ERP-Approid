package com.erpapproid.core.api.sales;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.sales.ReceivableDto.Response;
import com.erpapproid.core.api.sales.ReceivableDto.Summary;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.sales.ReceivableEntity;
import com.erpapproid.core.domain.sales.ReceivableRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "receivables", description = "미수금")
@RestController
@RequestMapping("/api/core/receivables")
@RequiredArgsConstructor
public class ReceivableController {

    private final ReceivableRepository receivableRepository;
    private final AuditService auditService;

    @Operation(summary = "미수금 목록")
    @GetMapping
    @PreAuthorize("hasAnyRole('SALES', 'ACCOUNTING', 'ADMIN')")
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                receivableRepository.search(status, customerId, pageable).map(this::toResponse));
    }

    @Operation(summary = "미수/연체 요약")
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('SALES', 'ACCOUNTING', 'ADMIN')")
    public ResponseEntity<Summary> summary() {
        return ResponseEntity.ok(Summary.builder()
                .openCount(receivableRepository.countByStatusNot(Constants.COLLECTED))
                .openAmount(receivableRepository.sumOpenAmount())
                .overdueCount(receivableRepository.countOverdue())
                .overdueAmount(receivableRepository.sumOverdueAmount())
                .build());
    }

    @Operation(summary = "수납 완료")
    @PostMapping("/{id}/collect")
    @PreAuthorize("hasAnyRole('ACCOUNTING', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> collect(@PathVariable Long id) {
        ReceivableEntity entity = receivableRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND,
                        "미수금을 찾을 수 없습니다: " + id));
        if (Constants.COLLECTED.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "이미 수납 완료된 미수금입니다: " + entity.getReceivableNo());
        }
        Response before = toResponse(entity);
        entity.setStatus(Constants.COLLECTED);
        entity.setOverdueDays(0);
        ReceivableEntity saved = receivableRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange(
                "COLLECT", "RECEIVABLE", saved.getReceivableNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    private Response toResponse(ReceivableEntity entity) {
        boolean overdue = !Constants.COLLECTED.equals(entity.getStatus())
                && entity.getDueDate() != null
                && entity.getDueDate().isBefore(java.time.LocalDate.now());
        return Response.builder()
                .id(entity.getId())
                .receivableNo(entity.getReceivableNo())
                .customerId(entity.getCustomer().getId())
                .customerName(entity.getCustomer().getName())
                .salesOrderId(entity.getSalesOrder() == null ? null : entity.getSalesOrder().getId())
                .salesOrderNo(entity.getSalesOrder() == null
                        ? null : entity.getSalesOrder().getSalesOrderNo())
                .amount(entity.getAmount())
                .dueDate(entity.getDueDate())
                .overdueDays(entity.getOverdueDays())
                .status(entity.getStatus())
                .overdue(overdue)
                .build();
    }
}
