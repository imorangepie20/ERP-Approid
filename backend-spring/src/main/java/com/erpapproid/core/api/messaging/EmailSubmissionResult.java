package com.erpapproid.core.api.messaging;

import java.util.Objects;
import com.erpapproid.core.domain.messaging.DeliveryOutcome;

public record EmailSubmissionResult(DeliveryOutcome outcome, Failure failure) {
    public enum Failure {
        CONNECTION_FAILED, SMTP_TRANSIENT_FAILURE, SMTP_PERMANENT_FAILURE, AUTH_FAILED,
        TLS_FAILED, SMTP_RESULT_UNKNOWN, TRANSPORT_EXCEPTION, EMAIL_DISABLED
    }

    public EmailSubmissionResult {
        Objects.requireNonNull(outcome, "outcome is required");
        if ((outcome == DeliveryOutcome.ACCEPTED) != (failure == null)) {
            throw new IllegalArgumentException("Accepted results have no failure; all other results require a safe code");
        }
    }

    public static EmailSubmissionResult accepted() {
        return new EmailSubmissionResult(DeliveryOutcome.ACCEPTED, null);
    }
}
