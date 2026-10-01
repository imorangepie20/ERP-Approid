package com.erpapproid.core.common.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RejectedValueSanitizerTest {

    @Test
    void redacts_sensitive_field_values() {
        assertThat(GlobalExceptionHandler.sanitizeRejectedValue("password", "super-secret"))
                .isEqualTo("[REDACTED]");
        assertThat(GlobalExceptionHandler.sanitizeRejectedValue("jwtSecret", "token-value"))
                .isEqualTo("[REDACTED]");
        assertThat(GlobalExceptionHandler.sanitizeRejectedValue("internalKey", "key-value"))
                .isEqualTo("[REDACTED]");
    }

    @Test
    void truncates_non_sensitive_values_to_a_bounded_length() {
        String sanitized = GlobalExceptionHandler.sanitizeRejectedValue("description", "a".repeat(300));

        assertThat(sanitized).hasSize(129).endsWith("…");
    }

    @Test
    void keeps_null_rejected_values_null() {
        assertThat(GlobalExceptionHandler.sanitizeRejectedValue("name", null)).isNull();
    }
}
