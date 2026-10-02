package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

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

import com.erpapproid.core.api.sales.QuotationDto.Request;
import com.erpapproid.core.api.sales.QuotationDto.Response;
import com.erpapproid.core.api.sales.QuotationDto.UpdateRequest;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.sales.QuotationEntity;
import com.erpapproid.core.domain.sales.QuotationRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "quotations", description = "견적")
@RestController
@RequestMapping("/api/core/quotations")
@RequiredArgsConstructor
public class QuotationController {

    private final QuotationRepository quotationRepository;
    private final PartnerRepository partnerRepository;
    private final ItemRepository itemRepository;
    private final AuditService auditService;

    @Operation(summary = "견적 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "quotationNo,desc") String sort) {
        var pageable = MasterListQuery.pageable(page, size, sort,
                Set.of("quotationNo", "customer.name", "item.itemNo", "qty", "unitPrice", "amount", "dueDate", "validUntil", "status"), "quotationNo");
        return ResponseEntity.ok(
                quotationRepository.findAll(SalesDocumentRules.filter("quotationNo", status, customerId, keyword,
                        Set.of(Constants.DRAFT, Constants.SENT, Constants.ORDERED, Constants.EXPIRED)), pageable).map(this::toResponse));
    }

    @Operation(summary = "견적 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(quotationRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.QUOTATION_NOT_FOUND,
                        "견적을 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "견적 생성")
    @PostMapping
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        if (quotationRepository.existsByQuotationNo(request.getQuotationNo())) {
            throw new DomainException(ErrorCode.QUOTATION_NO_DUPLICATE, "이미 사용 중인 견적번호입니다.");
        }
        PartnerEntity customer = partnerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new DomainException(ErrorCode.PARTNER_NOT_FOUND,
                        "거래처를 찾을 수 없습니다: " + request.getCustomerId()));
        ItemEntity item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + request.getItemId()));
        SalesDocumentRules.references(customer, item);
        QuotationEntity entity = QuotationEntity.builder()
                .quotationNo(request.getQuotationNo())
                .customer(customer)
                .item(item)
                .qty(request.getQty())
                .unitPrice(request.getUnitPrice())
                .amount(SalesDocumentRules.amount(request.getQty(), request.getUnitPrice()))
                .dueDate(request.getDueDate())
                .validUntil(request.getValidUntil())
                .status(Constants.DRAFT)
                .paymentTerms(customer.getPaymentTerms())
                .leadTimeDays(customer.getLeadTimeDays())
                .build();
        QuotationEntity saved = quotationRepository.save(entity);
        auditService.record(AuditEvent.sensitiveCreated(
                "QUOTATION", saved.getQuotationNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "견적 수정 (작성중만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) throw MasterListQuery.invalid("수정할 값을 입력하세요.");
        QuotationEntity entity = quotationRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.QUOTATION_NOT_FOUND,
                        "견적을 찾을 수 없습니다: " + id));
        if (!Constants.DRAFT.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "작성중 상태의 견적만 수정할 수 있습니다: " + entity.getQuotationNo());
        }
        Response before = toResponse(entity);
        applyRequest(entity, request);
        QuotationEntity saved = quotationRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange(
                "UPDATE", "QUOTATION", saved.getQuotationNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "견적 삭제 (작성중만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        QuotationEntity entity = quotationRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.QUOTATION_NOT_FOUND,
                        "견적을 찾을 수 없습니다: " + id));
        if (!Constants.DRAFT.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "작성중 상태의 견적만 삭제할 수 있습니다: " + entity.getQuotationNo());
        }
        Response before = toResponse(entity);
        quotationRepository.delete(entity);
        auditService.record(AuditEvent.sensitiveDeleted(
                "QUOTATION", entity.getQuotationNo(), before));
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "견적 발송 (작성중 → 발송완료)")
    @PostMapping("/{id}/send")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<Response> send(@PathVariable Long id) {
        QuotationEntity entity = quotationRepository.findForUpdate(id)
                .orElseThrow(() -> new DomainException(ErrorCode.QUOTATION_NOT_FOUND,
                        "견적을 찾을 수 없습니다: " + id));
        if (!Constants.DRAFT.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "작성중 상태의 견적만 발송할 수 있습니다: " + entity.getQuotationNo());
        }
        Response before = toResponse(entity);
        if (entity.getValidUntil().isBefore(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")))) {
            throw new DomainException(ErrorCode.QUOTATION_EXPIRED, "유효기간이 지난 견적은 발송할 수 없습니다.");
        }
        entity.setStatus(Constants.SENT);
        QuotationEntity saved = quotationRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange(
                "SEND", "QUOTATION", saved.getQuotationNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    private void applyRequest(QuotationEntity entity, UpdateRequest request) {
        if (request.getQty() != null) {
            entity.setQty(request.getQty());
        }
        if (request.getUnitPrice() != null) {
            entity.setUnitPrice(request.getUnitPrice());
        }
        entity.setAmount(SalesDocumentRules.amount(entity.getQty(), entity.getUnitPrice()));
        if (request.getDueDate() != null) {
            entity.setDueDate(request.getDueDate());
        }
        if (request.getValidUntil() != null) {
            entity.setValidUntil(request.getValidUntil());
        }
    }

    private Response toResponse(QuotationEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .quotationNo(entity.getQuotationNo())
                .customerId(entity.getCustomer().getId())
                .customerName(entity.getCustomer().getName())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .itemName(entity.getItem().getName())
                .qty(entity.getQty())
                .unitPrice(entity.getUnitPrice())
                .amount(entity.getAmount())
                .dueDate(entity.getDueDate())
                .validUntil(entity.getValidUntil())
                .status(entity.getStatus())
                .paymentTerms(entity.getPaymentTerms())
                .leadTimeDays(entity.getLeadTimeDays())
                .build();
    }
}
