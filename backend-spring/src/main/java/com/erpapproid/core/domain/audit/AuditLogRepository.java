package com.erpapproid.core.domain.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLogEntity, Long> {

    List<AuditLogEntity> findAllByTraceIdOrderByOccurredAtAsc(String traceId);
}
