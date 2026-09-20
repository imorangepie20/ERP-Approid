package com.erpapproid.core.domain.audit;

import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.erpapproid.core.common.web.TraceIdFilter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 감사 로그 서비스. api-spec.md 2.4 / desc.md 3.12:
 * 모든 쓰기 엔드포인트는 audit_logs 에 기록한다.
 * 원가/단가/결산 변경은 sensitive = true 로 별도 보존한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private static final String SYSTEM = "system";

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, String entityType, String entityNo,
                       Object before, Object after, boolean sensitive) {
        try {
            AuditLogEntity entity = AuditLogEntity.builder()
                    .actorId(currentActorId())
                    .action(action)
                    .entityType(entityType)
                    .entityNo(entityNo)
                    .beforeJson(toJson(before))
                    .afterJson(toJson(after))
                    .sensitive(sensitive)
                    .traceId(MDC.get(TraceIdFilter.TRACE_ID_KEY))
                    .occurredAt(java.time.Instant.now())
                    .build();
            auditLogRepository.save(entity);
        } catch (Exception ex) {
            log.warn("audit log failed for {} {}: {}", entityType, entityNo, ex.getMessage());
        }
    }

    public void record(String action, String entityType, String entityNo, Object after) {
        record(action, entityType, entityNo, null, after, false);
    }

    public void record(String action, String entityType, String entityNo,
                       Object before, Object after) {
        record(action, entityType, entityNo, before, after, false);
    }

    public void recordSensitive(String action, String entityType, String entityNo,
                                Object before, Object after) {
        record(action, entityType, entityNo, before, after, true);
    }

    private Long currentActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || SYSTEM.equals(auth.getPrincipal())) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof com.erpapproid.core.security.UserPrincipal up) {
            return up.getId();
        }
        return null;
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String s) {
            return s;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            log.warn("audit json serialization failed: {}", ex.getMessage());
            return null;
        }
    }
}
