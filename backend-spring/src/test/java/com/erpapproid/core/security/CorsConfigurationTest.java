package com.erpapproid.core.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

class CorsConfigurationTest {

    @Test
    void allows_only_configured_exact_origins_without_credentials() {
        SecurityProperties properties = new SecurityProperties();
        properties.getCors().setAllowedOrigins(List.of(
                "http://127.0.0.1:3000", "https://erp.example.com"));
        SecurityConfig config = new SecurityConfig(null, null, null, properties);

        CorsConfigurationSource source = config.corsConfigurationSource();
        CorsConfiguration cors = source.getCorsConfiguration(
                new MockHttpServletRequest("OPTIONS", "/api/core/items"));

        assertThat(cors).isNotNull();
        assertThat(cors.getAllowedOrigins()).containsExactly(
                "http://127.0.0.1:3000", "https://erp.example.com");
        assertThat(cors.getAllowedOriginPatterns()).isNullOrEmpty();
        assertThat(cors.getAllowCredentials()).isFalse();
        assertThat(cors.getAllowedHeaders()).containsExactly(
                "Authorization", "Content-Type", "X-Trace-Id");
        assertThat(cors.checkOrigin("https://erp.example.com")).isEqualTo("https://erp.example.com");
        assertThat(cors.checkOrigin("https://attacker.example")).isNull();
    }
}
