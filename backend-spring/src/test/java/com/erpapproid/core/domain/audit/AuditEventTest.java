package com.erpapproid.core.domain.audit;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

class AuditEventTest {

    @Test
    void create_update_and_delete_factories_enforce_snapshot_rules() {
        Map<String, Object> snapshot = Map.of("id", 1L);

        assertThatThrownBy(() -> AuditEvent.created("ITEM", "IT-1", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> AuditEvent.changed("UPDATE", "ITEM", "IT-1", null, snapshot))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> AuditEvent.changed("UPDATE", "ITEM", "IT-1", snapshot, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> AuditEvent.deleted("ITEM", "IT-1", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sensitive_factories_mark_financial_or_personal_snapshots() {
        Map<String, Object> snapshot = Map.of("amount", 1000L);

        assertThat(AuditEvent.sensitiveCreated("QUOTATION", "QT-1", snapshot).sensitive()).isTrue();
        assertThat(AuditEvent.sensitiveDeleted("PARTNER", "PT-1", snapshot).sensitive()).isTrue();
    }
}
