package com.erpapproid.core.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

class ProfileConfigurationTest {

    private final YamlPropertySourceLoader loader = new YamlPropertySourceLoader();

    @Test
    void common_configuration_has_no_development_secret_fallbacks() throws IOException {
        List<PropertySource<?>> sources = load("application.yml");

        assertThat(value(sources, "spring.profiles.active")).isNull();
        assertThat(value(sources, "app.security.jwt.secret")).isNull();
        assertThat(value(sources, "app.security.internal-key")).isNull();
    }

    @Test
    void local_and_test_enable_api_docs_but_production_disables_them() throws IOException {
        assertThat(value(load("application-local.yml"), "springdoc.api-docs.enabled"))
                .isEqualTo(true);
        assertThat(value(load("application-local.yml"), "springdoc.swagger-ui.enabled"))
                .isEqualTo(true);
        assertThat(value(load("application-test.yml"), "springdoc.api-docs.enabled"))
                .isEqualTo(true);
        assertThat(value(load("application-prod.yml"), "springdoc.api-docs.enabled"))
                .isEqualTo(false);
        assertThat(value(load("application-prod.yml"), "springdoc.swagger-ui.enabled"))
                .isEqualTo(false);
    }

    @Test
    void production_secrets_and_origins_have_no_development_defaults() throws IOException {
        List<PropertySource<?>> sources = load("application-prod.yml");

        assertThat(value(sources, "app.security.jwt.secret")).isEqualTo("${JWT_SECRET:}");
        assertThat(value(sources, "app.security.internal-key")).isEqualTo("${INTERNAL_KEY:}");
        assertThat(value(sources, "app.security.cors.allowed-origins"))
                .isEqualTo("${CORS_ALLOWED_ORIGINS:}");
    }

    @Test
    void local_cors_defaults_allow_both_loopback_frontend_addresses() throws IOException {
        assertThat(value(load("application-local.yml"), "app.security.cors.allowed-origins"))
                .isEqualTo("${CORS_ALLOWED_ORIGINS:http://127.0.0.1:3000,http://localhost:3000}");
    }

    private List<PropertySource<?>> load(String name) throws IOException {
        return loader.load(name, new ClassPathResource(name));
    }

    private static Object value(List<PropertySource<?>> sources, String key) {
        return sources.stream()
                .map(source -> source.getProperty(key))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }
}
