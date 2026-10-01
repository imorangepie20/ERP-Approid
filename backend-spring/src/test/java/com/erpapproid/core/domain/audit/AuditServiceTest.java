package com.erpapproid.core.domain.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.erpapproid.core.common.web.TraceIdFilter;
import com.erpapproid.core.security.CurrentActorProvider;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    private AuditLogRepository repository;
    @Mock
    private CurrentActorProvider actorProvider;

    @AfterEach
    void clearMdc() {
        MDC.clear();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void records_actor_trace_and_json_snapshots_synchronously() {
        SimpleMeterRegistry metrics = new SimpleMeterRegistry();
        AuditService service = new AuditService(repository, new ObjectMapper(), actorProvider, metrics);
        when(actorProvider.currentActorId()).thenReturn(Optional.of(7L));
        MDC.put(TraceIdFilter.TRACE_ID_KEY, "trace-01");

        TransactionSynchronizationManager.initSynchronization();
        service.record(AuditEvent.changed("UPDATE", "ITEM", "IT-1",
                Map.of("name", "before"), Map.of("name", "after")));

        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getActorId()).isEqualTo(7L);
        assertThat(captor.getValue().getTraceId()).isEqualTo("trace-01");
        assertThat(captor.getValue().getBeforeJson()).isEqualTo("{\"name\":\"before\"}");
        assertThat(captor.getValue().getAfterJson()).isEqualTo("{\"name\":\"after\"}");
        assertThat(metrics.find("erp.audit.events").tag("outcome", "recorded").counter()).isNull();
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        assertThat(metrics.get("erp.audit.events").tag("outcome", "recorded").counter().count()).isEqualTo(1);
    }

    @Test
    void propagates_persistence_failure_and_counts_it_fail_closed() {
        SimpleMeterRegistry metrics = new SimpleMeterRegistry();
        AuditService service = new AuditService(repository, new ObjectMapper(), actorProvider, metrics);
        when(actorProvider.currentActorId()).thenReturn(Optional.of(7L));
        doThrow(new IllegalStateException("database down")).when(repository).save(any());

        assertThatThrownBy(() -> service.record(AuditEvent.created(
                "ITEM", "IT-1", Map.of("id", 1L))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("database down");
        assertThat(metrics.get("erp.audit.events").tag("outcome", "failed").counter().count()).isEqualTo(1);
    }

    @Test
    void rejects_a_business_audit_without_an_authenticated_actor() {
        AuditService service = new AuditService(
                repository, new ObjectMapper(), actorProvider, new SimpleMeterRegistry());
        when(actorProvider.currentActorId()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.record(AuditEvent.created(
                "ITEM", "IT-1", Map.of("id", 1L))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Authenticated audit actor is required");
    }

    @Test
    void requires_an_existing_business_transaction() throws Exception {
        Transactional transactional = AuditService.class
                .getMethod("record", AuditEvent.class)
                .getAnnotation(Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.MANDATORY);
    }
}
