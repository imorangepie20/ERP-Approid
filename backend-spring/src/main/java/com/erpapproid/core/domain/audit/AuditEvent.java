package com.erpapproid.core.domain.audit;

import org.springframework.util.Assert;

public record AuditEvent(
        String action,
        String entityType,
        String entityNo,
        Object beforeSnapshot,
        Object afterSnapshot,
        boolean sensitive) {

    public AuditEvent {
        Assert.hasText(action, "audit action is required");
        Assert.hasText(entityType, "audit entityType is required");
        Assert.hasText(entityNo, "audit entityNo is required");
    }

    public static AuditEvent created(String entityType, String entityNo, Object afterSnapshot) {
        requireSnapshot(afterSnapshot, "CREATE requires an after snapshot");
        return new AuditEvent("CREATE", entityType, entityNo, null, afterSnapshot, false);
    }

    public static AuditEvent sensitiveCreated(String entityType, String entityNo, Object afterSnapshot) {
        requireSnapshot(afterSnapshot, "CREATE requires an after snapshot");
        return new AuditEvent("CREATE", entityType, entityNo, null, afterSnapshot, true);
    }

    public static AuditEvent changed(String action, String entityType, String entityNo,
                                     Object beforeSnapshot, Object afterSnapshot) {
        requireSnapshot(beforeSnapshot, action + " requires a before snapshot");
        requireSnapshot(afterSnapshot, action + " requires an after snapshot");
        return new AuditEvent(action, entityType, entityNo, beforeSnapshot, afterSnapshot, false);
    }

    public static AuditEvent sensitiveChange(String action, String entityType, String entityNo,
                                              Object beforeSnapshot, Object afterSnapshot) {
        requireSnapshot(beforeSnapshot, action + " requires a before snapshot");
        requireSnapshot(afterSnapshot, action + " requires an after snapshot");
        return new AuditEvent(action, entityType, entityNo, beforeSnapshot, afterSnapshot, true);
    }

    public static AuditEvent deleted(String entityType, String entityNo, Object beforeSnapshot) {
        requireSnapshot(beforeSnapshot, "DELETE requires a before snapshot");
        return new AuditEvent("DELETE", entityType, entityNo, beforeSnapshot, null, false);
    }

    public static AuditEvent sensitiveDeleted(String entityType, String entityNo, Object beforeSnapshot) {
        requireSnapshot(beforeSnapshot, "DELETE requires a before snapshot");
        return new AuditEvent("DELETE", entityType, entityNo, beforeSnapshot, null, true);
    }

    private static void requireSnapshot(Object snapshot, String message) {
        if (snapshot == null) {
            throw new IllegalArgumentException(message);
        }
    }
}
