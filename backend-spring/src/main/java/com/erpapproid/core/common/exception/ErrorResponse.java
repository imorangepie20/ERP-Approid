package com.erpapproid.core.common.exception;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private String code;
    private String message;
    private Instant timestamp;
    private String traceId;
    private java.util.List<FieldError> errors;

    public record FieldError(String field, String value, String reason) {
    }
}
