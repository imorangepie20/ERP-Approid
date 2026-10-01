package com.erpapproid.core.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TraceIdFilterTest {

    private final TraceIdFilter filter = new TraceIdFilter();

    @Test
    void preserves_valid_client_trace_id_during_request_and_clears_mdc_afterward() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/core/items");
        request.addHeader("X-Trace-Id", "client-trace_01");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) ->
                assertThat(MDC.get(TraceIdFilter.TRACE_ID_KEY)).isEqualTo("client-trace_01"));

        assertThat(response.getHeader("X-Trace-Id")).isEqualTo("client-trace_01");
        assertThat(MDC.get(TraceIdFilter.TRACE_ID_KEY)).isNull();
    }

    @Test
    void replaces_invalid_or_oversized_trace_ids_with_safe_server_ids() throws Exception {
        for (String invalid : new String[]{"bad trace", "<script>", "a".repeat(65)}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
            request.addHeader("X-Trace-Id", invalid);
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilter(request, response, (req, res) -> { });

            assertThat(response.getHeader("X-Trace-Id")).matches("[a-f0-9]{32}");
        }
    }
}
