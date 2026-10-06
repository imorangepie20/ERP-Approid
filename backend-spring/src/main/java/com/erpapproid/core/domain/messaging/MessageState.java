package com.erpapproid.core.domain.messaging;

public enum MessageState {
    QUEUED,
    CLAIMED,
    DISPATCHING,
    RETRY_WAIT,
    SMTP_ACCEPTED,
    FAILED,
    STALE,
    UNKNOWN
}
