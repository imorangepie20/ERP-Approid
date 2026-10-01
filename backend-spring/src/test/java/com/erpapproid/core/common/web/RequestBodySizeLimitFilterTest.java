package com.erpapproid.core.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;

class RequestBodySizeLimitFilterTest {

    private static final int LIMIT = 16;
    private final RequestBodySizeLimitFilter filter =
            new RequestBodySizeLimitFilter(LIMIT, new ObjectMapper().findAndRegisterModules());

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void rejects_declared_content_length_before_invoking_the_chain() throws Exception {
        MockHttpServletRequest request = requestWith("x".repeat(LIMIT + 1));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MDC.put(TraceIdFilter.TRACE_ID_KEY, "size-trace-1");

        filter.doFilter(request, response, (req, res) -> {
            throw new AssertionError("oversized request must not reach the chain");
        });

        assertPayloadTooLarge(response, "size-trace-1");
    }

    @Test
    void rejects_streamed_body_when_content_length_is_unknown() throws Exception {
        byte[] content = "x".repeat(LIMIT + 1).getBytes(StandardCharsets.UTF_8);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/core/auth/login") {
            @Override
            public long getContentLengthLong() {
                return -1;
            }

            @Override
            public int getContentLength() {
                return -1;
            }
        };
        request.setContent(content);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MDC.put(TraceIdFilter.TRACE_ID_KEY, "size-trace-2");

        filter.doFilter(request, response, (req, res) ->
                req.getInputStream().readAllBytes());

        assertPayloadTooLarge(response, "size-trace-2");
    }

    @Test
    void allows_body_at_the_configured_limit() throws Exception {
        MockHttpServletRequest request = requestWith("x".repeat(LIMIT));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) ->
                assertThat(req.getInputStream().readAllBytes()).hasSize(LIMIT));

        assertThat(response.getStatus()).isEqualTo(200);
    }

    private static MockHttpServletRequest requestWith(String body) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/core/auth/login");
        request.setContent(body.getBytes(StandardCharsets.UTF_8));
        return request;
    }

    private static void assertPayloadTooLarge(MockHttpServletResponse response, String traceId)
            throws Exception {
        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getHeader("Content-Security-Policy"))
                .isEqualTo("default-src 'none'; frame-ancestors 'none'");
        assertThat(response.getHeader("X-Frame-Options")).isEqualTo("DENY");
        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getContentAsString()).contains(
                "\"code\":\"PAYLOAD_TOO_LARGE\"",
                "\"traceId\":\"" + traceId + "\"");
    }
}
