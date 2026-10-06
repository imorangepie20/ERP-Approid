package com.erpapproid.core.api.messaging;

import java.util.UUID;

/** Immutable transport input. Business snapshots are generated before dispatch. */
public record EmailSubmission(UUID messageId, String recipient, String subject, String body, String smtpMessageId) {
    @Override
    public String toString() {
        return "EmailSubmission[messageId=" + messageId + "]";
    }
}
