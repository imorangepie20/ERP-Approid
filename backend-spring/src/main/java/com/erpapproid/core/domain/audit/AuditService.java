package com.erpapproid.core.domain.audit;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.erpapproid.core.common.web.TraceIdFilter;
import com.erpapproid.core.security.CurrentActorProvider;

import io.micrometer.core.instrument.MeterRegistry;

import lombok.RequiredArgsConstructor;

/**
 * 감사 로그 서비스. api-spec.md 2.4 / desc.md 3.12:
 * 모든 쓰기 엔드포인트는 audit_logs 에 기록한다.
 * 원가/단가/결산 변경은 sensitive = true 로 별도 보존한다.
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final CurrentActorProvider currentActorProvider;
    private final MeterRegistry meterRegistry;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuditEvent event) {
        try {
            Long actorId = currentActorProvider.currentActorId()
                    .orElseThrow(() -> new IllegalStateException("Authenticated audit actor is required"));
            AuditLogEntity entity = AuditLogEntity.builder()
                    .actorId(actorId)
                    .action(event.action())
                    .entityType(event.entityType())
                    .entityNo(event.entityNo())
                    .beforeJson(toJson(event.beforeSnapshot()))
                    .afterJson(toJson(event.afterSnapshot()))
                    .sensitive(event.sensitive())
                    .traceId(MDC.get(TraceIdFilter.TRACE_ID_KEY))
                    .occurredAt(java.time.Instant.now())
                    .build();
            auditLogRepository.save(entity);
            incrementRecordedAfterCommit();
        } catch (RuntimeException ex) {
            meterRegistry.counter("erp.audit.events", "outcome", "failed").increment();
            throw ex;
        }
    }

    private void incrementRecordedAfterCommit() {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                meterRegistry.counter("erp.audit.events", "outcome", "recorded").increment();
            }
        });
    }

    /** Internal worker entry: uses the authenticated request actor/trace retained in the queue, never REST input. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordAsActor(AuditEvent event, Long actorId, String traceId) {
        try {
            if (actorId == null || actorId <= 0 || traceId == null || traceId.isBlank() || traceId.length() > 128) {
                throw new IllegalStateException("Retained worker audit actor and trace are required");
            }
            auditLogRepository.save(AuditLogEntity.builder().actorId(actorId).action(event.action())
                    .entityType(event.entityType()).entityNo(event.entityNo()).beforeJson(toJson(event.beforeSnapshot()))
                    .afterJson(toJson(event.afterSnapshot())).sensitive(event.sensitive()).traceId(traceId)
                    .occurredAt(java.time.Instant.now()).build());
            incrementRecordedAfterCommit();
        } catch (RuntimeException ex) {
            meterRegistry.counter("erp.audit.events", "outcome", "failed").increment();
            throw ex;
        }
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize audit snapshot", ex);
        }
    }
}
