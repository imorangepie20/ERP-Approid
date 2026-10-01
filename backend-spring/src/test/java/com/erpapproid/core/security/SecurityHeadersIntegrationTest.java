package com.erpapproid.core.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

class SecurityHeadersIntegrationTest extends IntegrationTestSupport {

    @Test
    void emits_browser_security_headers() {
        ResponseEntity<String> response = rest.getForEntity("/actuator/health", String.class);

        assertThat(response.getHeaders().getFirst("Content-Security-Policy"))
                .isEqualTo("default-src 'none'; frame-ancestors 'none'");
        assertThat(response.getHeaders().getFirst("X-Frame-Options")).isEqualTo("DENY");
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getHeaders().getFirst("Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(response.getHeaders().getFirst("Permissions-Policy"))
                .isEqualTo("camera=(), microphone=(), geolocation=()");
    }

    @Test
    void trusts_forwarded_https_for_hsts() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Forwarded-Proto", "https");

        ResponseEntity<String> response = rest.exchange(
                "/actuator/health", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getHeaders().getFirst("Strict-Transport-Security"))
                .isEqualTo("max-age=31536000 ; includeSubDomains");
    }

    @Test
    void accepts_only_configured_cors_origins_and_does_not_allow_credentials() {
        ResponseEntity<String> loopbackIp = preflight("http://127.0.0.1:3000");
        ResponseEntity<String> localhost = preflight("http://localhost:3000");
        ResponseEntity<String> denied = preflight("https://attacker.example");

        assertThat(loopbackIp.getStatusCode().value()).isEqualTo(200);
        assertThat(loopbackIp.getHeaders().getAccessControlAllowOrigin())
                .isEqualTo("http://127.0.0.1:3000");
        assertThat(loopbackIp.getHeaders().getAccessControlAllowCredentials()).isFalse();
        assertThat(loopbackIp.getHeaders().getAccessControlAllowHeaders())
                .containsExactlyInAnyOrder("Authorization", "Content-Type", "X-Trace-Id");
        assertThat(localhost.getStatusCode().value()).isEqualTo(200);
        assertThat(localhost.getHeaders().getAccessControlAllowOrigin())
                .isEqualTo("http://localhost:3000");
        assertThat(denied.getStatusCode().value()).isEqualTo(403);
        assertThat(denied.getHeaders().getAccessControlAllowOrigin()).isNull();
    }

    @Test
    void oversized_body_returns_common_413_with_the_same_trace_id_in_header_and_body() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Trace-Id", "payload-too-large-trace");
        String oversizedJson = "{\"username\":\"admin\",\"password\":\""
                + "x".repeat(1_048_576) + "\"}";

        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/auth/login", HttpMethod.POST,
                new HttpEntity<>(oversizedJson, headers), JsonNode.class);

        assertThat(response.getStatusCode().value()).isEqualTo(413);
        assertThat(response.getHeaders().getFirst("X-Trace-Id"))
                .isEqualTo("payload-too-large-trace");
        assertThat(response.getHeaders().getFirst("Content-Security-Policy"))
                .isEqualTo("default-src 'none'; frame-ancestors 'none'");
        assertThat(response.getHeaders().getFirst("X-Frame-Options")).isEqualTo("DENY");
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().path("code").asText()).isEqualTo("PAYLOAD_TOO_LARGE");
        assertThat(response.getBody().path("traceId").asText())
                .isEqualTo("payload-too-large-trace");
    }

    private ResponseEntity<String> preflight(String origin) {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin(origin);
        headers.setAccessControlRequestMethod(HttpMethod.POST);
        headers.setAccessControlRequestHeaders(java.util.List.of(
                "Authorization", "Content-Type", "X-Trace-Id"));
        return rest.exchange("/api/core/items", HttpMethod.OPTIONS,
                new HttpEntity<>(headers), String.class);
    }
}
