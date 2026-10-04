package com.erpapproid.core.common.exception;

import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String TRACE_ID_KEY = "traceId";

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ErrorResponse> handleDomain(DomainException ex, HttpServletRequest request) {
        ErrorCode code = ex.getErrorCode();
        if (code.getStatus().is5xxServerError()) {
            log.error("domain error: {}", ex.getMessage(), ex);
        } else {
            log.warn("domain error: {} {}", code.getCode(), ex.getMessage());
        }
        return build(code, ex.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<ErrorResponse.FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ErrorResponse.FieldError(
                        fe.getField(),
                        sanitizeRejectedValue(fe.getField(), fe.getRejectedValue()),
                        fe.getDefaultMessage()))
                .toList();
        log.warn("validation error: {} field(s)", errors.size());
        return build(ErrorCode.INVALID_INPUT, "입력값 검증에 실패했습니다.", errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraint(ConstraintViolationException ex) {
        List<ErrorResponse.FieldError> errors = ex.getConstraintViolations().stream()
                .map(cv -> new ErrorResponse.FieldError(
                        cv.getPropertyPath().toString(),
                        sanitizeRejectedValue(cv.getPropertyPath().toString(), cv.getInvalidValue()),
                        cv.getMessage()))
                .toList();
        return build(ErrorCode.INVALID_INPUT, "입력값 검증에 실패했습니다.", errors);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(HttpMessageNotReadableException ex) {
        log.warn("message not readable: {}", ex.getMessage());
        return build(ErrorCode.INVALID_INPUT, "요청 본문을 읽을 수 없습니다. JSON 형식을 확인해 주세요.", null);
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(
            org.springframework.web.HttpMediaTypeNotSupportedException ex) {
        log.warn("media type not supported: {}", ex.getMessage());
        return build(ErrorCode.INVALID_INPUT, "지원하지 않는 Content-Type 입니다: " + ex.getContentType(), null);
    }

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(
            org.springframework.web.HttpRequestMethodNotSupportedException ex) {
        var methods = ex.getSupportedHttpMethods();
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .allow(methods == null ? new org.springframework.http.HttpMethod[0]
                        : methods.toArray(org.springframework.http.HttpMethod[]::new))
                .body(build(ErrorCode.METHOD_NOT_ALLOWED, "지원하지 않는 HTTP 메서드입니다.", null).getBody());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return build(ErrorCode.INVALID_INPUT, "파라미터 타입이 올바르지 않습니다: " + ex.getName(), null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return build(ErrorCode.INVALID_INPUT, ex.getMessage(), null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex) {
        return build(ErrorCode.UNAUTHORIZED, "인증이 필요합니다.", null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return build(ErrorCode.FORBIDDEN, "접근 권한이 없습니다.", null);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoHandlerFoundException ex) {
        return build(ErrorCode.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다.", null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        String message = ex.getMostSpecificCause().getMessage();
        if (message != null && message.contains("duplicate key")) {
            return build(ErrorCode.DUPLICATE, "이미 존재하는 값입니다.", null);
        }
        if (message != null && (message.contains("foreign key") || message.contains("violates"))) {
            return build(ErrorCode.IN_USE, "참조 중인 데이터는 변경할 수 없습니다.", null);
        }
        return build(ErrorCode.DUPLICATE, "데이터 정합성 위반이 발생했습니다.", null);
    }

    @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(
            org.springframework.dao.OptimisticLockingFailureException ex) {
        log.warn("optimistic lock conflict: {}", ex.getMessage());
        return build(ErrorCode.DUPLICATE, "동시에 수정되어 충돌이 발생했습니다. 다시 시도해 주세요.", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("unexpected error", ex);
        return build(ErrorCode.INTERNAL_ERROR, "서버 오류가 발생했습니다.", null);
    }

    private ResponseEntity<ErrorResponse> build(ErrorCode errorCode, String message,
                                                List<ErrorResponse.FieldError> errors) {
        ErrorResponse body = ErrorResponse.builder()
                .code(errorCode.getCode())
                .message(message)
                .timestamp(Instant.now())
                .traceId(MDC.get(TRACE_ID_KEY))
                .errors(errors)
                .build();
        HttpStatus status = errorCode.getStatus();
        return ResponseEntity.status(status).body(body);
    }

    static String sanitizeRejectedValue(String field, Object rejectedValue) {
        if (rejectedValue == null) {
            return null;
        }
        String normalizedField = field == null ? "" : field.toLowerCase(java.util.Locale.ROOT);
        if (normalizedField.contains("password") || normalizedField.contains("secret")
                || normalizedField.contains("token") || normalizedField.contains("authorization")
                || normalizedField.endsWith("key") || normalizedField.contains("internalkey")) {
            return "[REDACTED]";
        }
        String value = rejectedValue.toString();
        return value.length() <= 128 ? value : value.substring(0, 128) + "…";
    }
}
