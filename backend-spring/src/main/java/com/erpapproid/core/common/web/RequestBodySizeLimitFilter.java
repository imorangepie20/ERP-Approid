package com.erpapproid.core.common.web;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.Instant;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.exception.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class RequestBodySizeLimitFilter extends OncePerRequestFilter {

    private final int maximumBodyBytes;
    private final ObjectMapper objectMapper;

    public RequestBodySizeLimitFilter(
            @Value("${app.web.max-request-body-size-bytes:1048576}") int maximumBodyBytes,
            ObjectMapper objectMapper) {
        if (maximumBodyBytes < 1) {
            throw new IllegalArgumentException("app.web.max-request-body-size-bytes must be positive");
        }
        this.maximumBodyBytes = maximumBodyBytes;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (request.getContentLengthLong() > maximumBodyBytes) {
            writePayloadTooLarge(response);
            return;
        }

        byte[] body = readBody(request);
        if (body == null) {
            writePayloadTooLarge(response);
            return;
        }
        filterChain.doFilter(new CachedBodyRequest(request, body), response);
    }

    private byte[] readBody(HttpServletRequest request) throws IOException {
        try (ByteArrayOutputStream body = new ByteArrayOutputStream(
                Math.min(Math.max(request.getContentLength(), 0), maximumBodyBytes))) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = request.getInputStream().read(buffer)) != -1) {
                total += read;
                if (total > maximumBodyBytes) {
                    return null;
                }
                body.write(buffer, 0, read);
            }
            return body.toByteArray();
        }
    }

    private void writePayloadTooLarge(HttpServletResponse response) throws IOException {
        ErrorResponse body = ErrorResponse.builder()
                .code(ErrorCode.PAYLOAD_TOO_LARGE.getCode())
                .message("Request body exceeds the configured size limit.")
                .timestamp(Instant.now())
                .traceId(MDC.get(TraceIdFilter.TRACE_ID_KEY))
                .build();
        response.resetBuffer();
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(java.nio.charset.StandardCharsets.UTF_8.name());
        response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        objectMapper.writeValue(response.getWriter(), body);
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return input.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                    if (readListener == null) {
                        throw new IllegalArgumentException("readListener is required");
                    }
                    try {
                        if (isFinished()) {
                            readListener.onAllDataRead();
                        } else {
                            readListener.onDataAvailable();
                        }
                    } catch (IOException ex) {
                        readListener.onError(ex);
                    }
                }

                @Override
                public int read() {
                    return input.read();
                }

                @Override
                public int read(byte[] target, int offset, int length) {
                    return input.read(target, offset, length);
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(),
                    getCharacterEncoding() == null
                            ? java.nio.charset.StandardCharsets.UTF_8
                            : java.nio.charset.Charset.forName(getCharacterEncoding())));
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
