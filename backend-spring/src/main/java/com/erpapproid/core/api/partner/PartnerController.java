package com.erpapproid.core.api.partner;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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

import com.erpapproid.core.api.partner.PartnerDto.Request;
import com.erpapproid.core.api.partner.PartnerDto.Response;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.purchase.PurchaseOrderRepository;
import com.erpapproid.core.domain.sales.SalesOrderRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "partners", description = "거래처")
@RestController
@RequestMapping("/api/core/partners")
@RequiredArgsConstructor
public class PartnerController {

    private final PartnerRepository partnerRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final AuditService auditService;

    @Operation(summary = "거래처 목록")
    @GetMapping
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String partnerType,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                partnerRepository.search(partnerType, keyword, pageable).map(this::toResponse));
    }

    @Operation(summary = "거래처 상세")
    @GetMapping("/{id}")
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(partnerRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "거래처 생성")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SALES')")
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        PartnerEntity entity = PartnerEntity.builder()
                .partnerNo(request.getPartnerNo())
                .name(request.getName())
                .contact(request.getContact())
                .paymentTerms(request.getPaymentTerms() == null ? 30 : request.getPaymentTerms())
                .partnerType(request.getPartnerType())
                .build();
        PartnerEntity saved = partnerRepository.save(entity);
        auditService.record("CREATE", "PARTNER", saved.getPartnerNo(), toResponse(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "거래처 수정")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SALES')")
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        PartnerEntity entity = partnerRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        applyRequest(entity, request);
        PartnerEntity saved = partnerRepository.save(entity);
        auditService.record("UPDATE", "PARTNER", saved.getPartnerNo(), before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "거래처 삭제")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        PartnerEntity entity = partnerRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + id));
        boolean inUse = salesOrderRepository.existsByCustomer_Id(id)
                || purchaseOrderRepository.existsByVendor_Id(id);
        if (inUse) {
            throw new DomainException(ErrorCode.PARTNER_IN_USE,
                    "거래처를 참조 중인 데이터가 있습니다.");
        }
        partnerRepository.delete(entity);
        auditService.record("DELETE", "PARTNER", entity.getPartnerNo(), null);
        return ResponseEntity.noContent().build();
    }

    private void applyRequest(PartnerEntity entity, Request request) {
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getContact() != null) {
            entity.setContact(request.getContact());
        }
        if (request.getPaymentTerms() != null) {
            entity.setPaymentTerms(request.getPaymentTerms());
        }
        if (request.getPartnerType() != null) {
            entity.setPartnerType(request.getPartnerType());
        }
    }

    private Response toResponse(PartnerEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .partnerNo(entity.getPartnerNo())
                .name(entity.getName())
                .contact(entity.getContact())
                .paymentTerms(entity.getPaymentTerms())
                .partnerType(entity.getPartnerType())
                .build();
    }
}
