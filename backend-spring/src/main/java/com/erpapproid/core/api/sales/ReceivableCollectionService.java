package com.erpapproid.core.api.sales;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.web.TraceIdFilter;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.sales.ReceivableRepository;
import com.erpapproid.core.domain.sales.ReceivableCollectionRepository;
import com.erpapproid.core.domain.sales.ReceivableCollectionEntity;
import com.erpapproid.core.security.CurrentActorProvider;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReceivableCollectionService {
    private final ReceivableRepository receivables;
    private final ReceivableCollectionRepository collections;
    private final CurrentActorProvider actors;
    private final AuditService audit;

    @Transactional
    public ReceivableDto.CollectionResult collect(Long id, ReceivableDto.CollectionRequest input) {
        var today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        if (input.collectedOn().isAfter(today)) throw new DomainException(ErrorCode.INVALID_INPUT, "수납일은 서울 오늘 이후일 수 없습니다.");
        long actorId = actors.currentActorId().orElseThrow(() -> new DomainException(ErrorCode.UNAUTHORIZED, "인증된 수납 처리자가 필요합니다."));
        var entity = receivables.findForUpdate(id).orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND, "미수금을 찾을 수 없습니다: " + id));
        var previous = collections.findByReceivable_IdAndRequestId(id, input.requestId());
        if (previous.isPresent()) {
            var saved = previous.get();
            if (!saved.getAmount().equals(input.amount()) || !saved.getCollectedOn().equals(input.collectedOn()) || saved.getActorId() != actorId) {
                throw new DomainException(ErrorCode.DUPLICATE, "같은 수납 요청 키의 금액·일자·처리자가 다릅니다.");
            }
            return new ReceivableDto.CollectionResult(ReceivableMapper.response(entity, today), ReceivableMapper.collection(saved), true);
        }
        long remaining = entity.getAmount() - entity.getCollectedAmount();
        if (remaining <= 0 || Constants.COLLECTED.equals(entity.getStatus())) throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION, "이미 수납 완료되었거나 수납할 잔액이 없습니다.");
        if (input.amount() > remaining) throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "수납 금액이 현재 잔액을 초과합니다.");
        var before = ReceivableMapper.response(entity, today);
        entity.setCollectedAmount(entity.getCollectedAmount() + input.amount());
        if (entity.getCollectedAmount().equals(entity.getAmount())) { entity.setStatus(Constants.COLLECTED); entity.setOverdueDays(0); }
        receivables.saveAndFlush(entity);
        var payment = collections.saveAndFlush(ReceivableCollectionEntity.builder().receivable(entity)
                .requestId(input.requestId()).amount(input.amount()).collectedOn(input.collectedOn())
                .remainingAmount(remaining - input.amount()).actorId(actorId)
                .traceId(MDC.get(TraceIdFilter.TRACE_ID_KEY)).recordedAt(Instant.now()).build());
        var result = new ReceivableDto.CollectionResult(ReceivableMapper.response(entity, today), ReceivableMapper.collection(payment), false);
        audit.record(AuditEvent.sensitiveChange("COLLECT", "RECEIVABLE", entity.getReceivableNo(), before, result));
        return result;
    }
}
