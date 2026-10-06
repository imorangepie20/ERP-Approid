package com.erpapproid.core.domain.messaging;

public enum DeliveryOutcome {
    ACCEPTED,
    DEFINITELY_NOT_ACCEPTED_TRANSIENT,
    DEFINITELY_NOT_ACCEPTED_PERMANENT,
    UNKNOWN
}
