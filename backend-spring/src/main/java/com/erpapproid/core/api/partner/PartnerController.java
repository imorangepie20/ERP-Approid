package com.erpapproid.core.api.partner;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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

import com.erpapproid.core.api.partner.PartnerDto.CreateRequest;
import com.erpapproid.core.api.partner.PartnerDto.UpdateRequest;
import com.erpapproid.core.api.partner.PartnerDto.Response;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.purchase.PurchaseOrderRepository;
import com.erpapproid.core.domain.sales.SalesOrderRepository;
import com.erpapproid.core.domain.sales.QuotationRepository;
import com.erpapproid.core.domain.sales.ShipmentRepository;
import com.erpapproid.core.domain.sales.ReceivableRepository;
import com.erpapproid.core.domain.purchase.ReceivingRepository;

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
    private final QuotationRepository quotationRepository;
    private final ShipmentRepository shipmentRepository;
    private final ReceivableRepository receivableRepository;
    private final ReceivingRepository receivingRepository;
    private final AuditService auditService;
    private final com.erpapproid.core.domain.messaging.PartnerMessageContactRepository messageContacts;

    @Operation(summary = "거래처 목록")
    @GetMapping
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String partnerType,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "partnerNo,asc") String sort) {
        if (keyword != null && keyword.length() > 128) throw invalid("검색어는 128자 이하여야 합니다.");
        if (partnerType != null && partnerType.isBlank()) partnerType = null;
        if (partnerType != null && !Set.of("고객사", "발주처", "외주처").contains(partnerType)) {
            throw invalid("지원하지 않는 거래처 유형입니다.");
        }
        if (page < 0 || page > 10000 || size < 1 || size > 100) throw invalid("페이지 범위가 올바르지 않습니다.");
        String[] parts = sort.split(",", -1);
        if (parts.length != 2 || !Set.of("partnerNo", "name", "partnerType", "contactName",
                "contact", "paymentTerms", "leadTimeDays").contains(parts[0])) throw invalid("정렬 기준이 올바르지 않습니다.");
        Sort order;
        try { order = Sort.by(Sort.Direction.fromString(parts[1]), parts[0]); }
        catch (IllegalArgumentException ex) { throw invalid("정렬 방향이 올바르지 않습니다."); }
        if (!parts[0].equals("partnerNo")) order = order.and(Sort.by("partnerNo"));
        Pageable pageable = PageRequest.of(page, size, order);
        if (keyword != null) keyword = keyword.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_");
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
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody CreateRequest request) {
        if (partnerRepository.existsByPartnerNo(request.getPartnerNo())) {
            throw new DomainException(ErrorCode.PARTNER_NO_DUPLICATE, "이미 존재하는 거래처 코드입니다.");
        }
        PartnerEntity entity = PartnerEntity.builder()
                .partnerNo(request.getPartnerNo())
                .name(request.getName())
                .contact(request.getContact())
                .contactName(request.getContactName())
                .leadTimeDays(request.getLeadTimeDays() == null ? 0 : request.getLeadTimeDays())
                .paymentTerms(request.getPaymentTerms() == null ? 30 : request.getPaymentTerms())
                .partnerType(request.getPartnerType())
                .build();
        PartnerEntity saved = partnerRepository.save(entity);
        auditService.record(AuditEvent.sensitiveCreated(
                "PARTNER", saved.getPartnerNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "거래처 수정")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SALES')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) throw invalid("수정할 거래처 정보를 입력하세요.");
        PartnerEntity entity = partnerRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        applyRequest(entity, request);
        PartnerEntity saved = partnerRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange(
                "UPDATE", "PARTNER", saved.getPartnerNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "거래처 삭제")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        PartnerEntity entity = partnerRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + id));
        boolean inUse = salesOrderRepository.existsByCustomer_Id(id)
                || purchaseOrderRepository.existsByVendor_Id(id)
                || quotationRepository.existsByCustomer_Id(id)
                || shipmentRepository.existsByCustomer_Id(id)
                || receivableRepository.existsByCustomer_Id(id)
                || receivingRepository.existsByVendor_Id(id)
                || messageContacts.existsByPartner_Id(id);
        if (inUse) {
            throw new DomainException(ErrorCode.PARTNER_IN_USE,
                    "거래처를 참조 중인 데이터가 있습니다.");
        }
        Response before = toResponse(entity);
        partnerRepository.delete(entity);
        auditService.record(AuditEvent.sensitiveDeleted("PARTNER", entity.getPartnerNo(), before));
        return ResponseEntity.noContent().build();
    }

    private DomainException invalid(String message) {
        return new DomainException(ErrorCode.INVALID_INPUT, message);
    }

    private void applyRequest(PartnerEntity entity, UpdateRequest request) {
        if (request.getContactName() != null) entity.setContactName(request.getContactName());
        if (request.getLeadTimeDays() != null) entity.setLeadTimeDays(request.getLeadTimeDays());
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
                .contactName(entity.getContactName())
                .leadTimeDays(entity.getLeadTimeDays())
                .paymentTerms(entity.getPaymentTerms())
                .partnerType(entity.getPartnerType())
                .build();
    }
}
