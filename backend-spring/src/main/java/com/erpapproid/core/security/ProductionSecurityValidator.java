package com.erpapproid.core.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class ProductionSecurityValidator implements InitializingBean {

    private static final int MINIMUM_SECRET_BYTES = 32;
    private static final int MINIMUM_DATABASE_PASSWORD_BYTES = 16;
    private static final int MAXIMUM_PRODUCTION_BODY_BYTES = 1_048_576;
    private static final List<String> ALLOWED_PROFILES = List.of("local", "test", "prod");
    private static final List<String> UNSAFE_MARKERS = List.of(
            "example", "change-me", "change_me", "changeme", "replace-me", "replace_me",
            "default-secret", "default_secret", "dev-secret", "dev_secret",
            "local-only", "local_only", "erp_dev_pw", "sample-secret", "your-");

    private final SecurityProperties properties;
    private final DataSourceProperties dataSourceProperties;
    private final Environment environment;

    @Override
    public void afterPropertiesSet() {
        String activeProfile = validateActiveProfile(environment.getActiveProfiles());
        if (!"prod".equals(activeProfile)) {
            return;
        }
        if (environment.containsProperty("spring.datasource.hikari.password")) {
            throw new IllegalStateException(
                    "spring.datasource.hikari.password is not allowed; configure DB_PASSWORD only");
        }
        if (environment.getProperty("springdoc.api-docs.enabled", Boolean.class, true)
                || environment.getProperty("springdoc.swagger-ui.enabled", Boolean.class, true)) {
            throw new IllegalStateException("Swagger and OpenAPI must be disabled in the prod profile");
        }
        int requestBodyLimit = environment.getProperty(
                "app.web.max-request-body-size-bytes", Integer.class, MAXIMUM_PRODUCTION_BODY_BYTES);
        if (requestBodyLimit < 1 || requestBodyLimit > MAXIMUM_PRODUCTION_BODY_BYTES) {
            throw new IllegalStateException(
                    "Production request body limit must be between 1 and 1048576 bytes");
        }
        String jwtSecret = validateSecret("JWT_SECRET", properties.getJwt().getSecret());
        String internalKey = validateSecret("INTERNAL_KEY", properties.getInternalKey());
        validateSecret("DB_PASSWORD", dataSourceProperties.getPassword(), MINIMUM_DATABASE_PASSWORD_BYTES);
        if (MessageDigest.isEqual(jwtSecret.getBytes(StandardCharsets.UTF_8),
                internalKey.getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalStateException("JWT_SECRET and INTERNAL_KEY must be different");
        }
        validateOrigins(properties.getCors().getAllowedOrigins());
    }

    private static String validateActiveProfile(String[] activeProfiles) {
        if (activeProfiles.length != 1) {
            throw new IllegalStateException(
                    "Application requires exactly one active profile: local, test, or prod");
        }
        String profile = activeProfiles[0];
        if (!ALLOWED_PROFILES.contains(profile)) {
            throw new IllegalStateException("Active profile must be one of: local, test, prod");
        }
        return profile;
    }

    private static String validateSecret(String name, String value) {
        return validateSecret(name, value, MINIMUM_SECRET_BYTES);
    }

    private static String validateSecret(String name, String value, int minimumBytes) {
        String secret = value == null ? "" : value.trim();
        if (secret.isEmpty()) {
            throw new IllegalStateException(name + " is required in the prod profile");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < minimumBytes) {
            throw new IllegalStateException(name + " must contain at least " + minimumBytes + " UTF-8 bytes");
        }
        String normalized = secret.toLowerCase(Locale.ROOT);
        if (UNSAFE_MARKERS.stream().anyMatch(normalized::contains)) {
            throw new IllegalStateException(name + " must not use a development or example value");
        }
        return secret;
    }

    private static void validateOrigins(List<String> origins) {
        if (origins == null || origins.isEmpty()
                || origins.stream().allMatch(origin -> origin == null || origin.isBlank())) {
            throw new IllegalStateException("CORS_ALLOWED_ORIGINS is required in the prod profile");
        }
        for (String origin : origins) {
            validateOrigin(origin);
        }
    }

    private static void validateOrigin(String origin) {
        if (!hasText(origin) || "null".equals(origin) || origin.contains("*")) {
            throw invalidOrigin();
        }
        try {
            URI uri = new URI(origin);
            int port = uri.getPort();
            boolean canonical = "https".equals(uri.getScheme())
                    && hasText(uri.getHost())
                    && uri.getUserInfo() == null
                    && (uri.getPath() == null || uri.getPath().isEmpty())
                    && uri.getQuery() == null
                    && uri.getFragment() == null
                    && (port == -1 || (port >= 1 && port <= 65_535))
                    && origin.equals("https://" + uri.getRawAuthority());
            if (!canonical) {
                throw invalidOrigin();
            }
        } catch (URISyntaxException ex) {
            throw invalidOrigin();
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static IllegalStateException invalidOrigin() {
        return new IllegalStateException(
                "CORS_ALLOWED_ORIGINS must contain canonical HTTPS origins only");
    }
}
