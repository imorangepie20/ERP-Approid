package com.erpapproid.core.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.erpapproid.core.security.JwtAuthenticationFilter;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.core.read.ListAppender;

class RequestLoggingFilterTest {

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void logs_one_structured_request_summary_without_query_parameters() throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(RequestLoggingFilter.class);
        ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        MDC.put(TraceIdFilter.TRACE_ID_KEY, "trace-log-1");
        try {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/core/items");
            request.setQueryString("password=must-not-log");
            request.setAttribute(JwtAuthenticationFilter.AUTHENTICATED_USER_ATTRIBUTE, "admin");
            MockHttpServletResponse response = new MockHttpServletResponse();

            new RequestLoggingFilter().doFilter(request, response, (req, res) ->
                    ((MockHttpServletResponse) res).setStatus(201));

            assertThat(appender.list).hasSize(1);
            String message = appender.list.getFirst().getFormattedMessage();
            String keyValues = appender.list.getFirst().getKeyValuePairs().toString();
            assertThat(message).isEqualTo("HTTP request completed");
            assertThat(keyValues).contains(
                    "event=\"http_request\"", "http.method=\"POST\"",
                    "http.path=\"/api/core/items\"", "http.status=\"201\"",
                    "durationMs=", "user=\"admin\"");
            assertThat(appender.list.getFirst().getMDCPropertyMap())
                    .containsEntry(TraceIdFilter.TRACE_ID_KEY, "trace-log-1");
            assertThat(message).doesNotContain("password", "must-not-log");
            assertThat(keyValues).doesNotContain("password", "must-not-log");
        } finally {
            logger.detachAppender(appender);
        }
    }
}
