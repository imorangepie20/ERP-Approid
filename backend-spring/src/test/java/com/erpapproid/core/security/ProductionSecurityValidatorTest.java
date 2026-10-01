package com.erpapproid.core.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.mock.env.MockEnvironment;

class ProductionSecurityValidatorTest {

    @ParameterizedTest(name = "rejects unsafe secrets: {0}")
    @MethodSource("unsafeSecrets")
    void rejects_unsafe_production_secrets(String description, String jwtSecret,
                                           String internalKey, String expectedMessage) {
        SecurityProperties properties = properties(jwtSecret, internalKey);

        assertThatThrownBy(() -> validator(properties, "db-P8$f6D4s2A0z9X7v5N3").afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(expectedMessage);
    }

    @Test
    void accepts_distinct_non_example_secrets_of_at_least_32_utf8_bytes() {
        SecurityProperties properties = properties(
                "jwt-A9!c2E4g6I8k0M2o4Q6s8U0w2Y4z6B8d",
                "internal-Z7@x5V3t1R9p7N5l3J1h9F7d5S3a1Q");

        validator(properties, "db-P8$f6D4s2A0z9X7v5N3").afterPropertiesSet();
    }

    @Test
    void does_not_reject_safe_values_merely_containing_dev_or_change_substrings() {
        SecurityProperties properties = properties(
                "device-token-A9!c2E4g6I8k0M2o4Q6s8U0w2Y4",
                "exchange-key-Z7@x5V3t1R9p7N5l3J1h9F7d5S3");

        validator(properties, "device-db-P8$f6D4s2A0z9X7v5N3").afterPropertiesSet();
    }

    @Test
    void rejects_missing_active_profile() {
        assertThatThrownBy(() -> validatorWithProfiles().afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly one active profile");
    }

    @Test
    void rejects_unknown_active_profile() {
        assertThatThrownBy(() -> validatorWithProfiles("staging").afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("local, test, prod");
    }

    @ParameterizedTest
    @MethodSource("invalidProfileCombinations")
    void rejects_multiple_active_profiles(String first, String second) {
        assertThatThrownBy(() -> validatorWithProfiles(first, second).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly one active profile");
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"local", "test"})
    void accepts_single_non_production_profile_without_production_secrets(String profile) {
        validatorWithProfiles(profile).afterPropertiesSet();
    }

    @ParameterizedTest(name = "rejects unsafe production CORS origin: {0}")
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "null",
            "http://erp.example.com",
            "https://erp.example.com/",
            "https://erp.example.com/path",
            "https://erp.example.com?source=test",
            "https://erp.example.com#fragment",
            "https://user@erp.example.com",
            "https://erp.example.com:99999"
    })
    void rejects_non_canonical_or_insecure_production_origins(String origin) {
        SecurityProperties properties = safeProductionProperties();
        properties.getCors().setAllowedOrigins(List.of(origin));

        assertThatThrownBy(() -> validator(properties, "db-P8$f6D4s2A0z9X7v5N3").afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CORS_ALLOWED_ORIGINS");
    }

    @Test
    void accepts_canonical_https_production_origin_with_explicit_valid_port() {
        SecurityProperties properties = safeProductionProperties();
        properties.getCors().setAllowedOrigins(List.of("https://erp.example.com:8443"));

        validator(properties, "db-P8$f6D4s2A0z9X7v5N3").afterPropertiesSet();
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"weak-override", "", "   "})
    void rejects_hikari_specific_password_that_would_override_validated_database_password(
            String override) {
        SecurityProperties properties = safeProductionProperties();
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.datasource.hikari.password", override);
        environment.setActiveProfiles("prod");
        DataSourceProperties dataSourceProperties = new DataSourceProperties();
        dataSourceProperties.setPassword("db-P8$f6D4s2A0z9X7v5N3");

        assertThatThrownBy(() -> new ProductionSecurityValidator(
                properties, dataSourceProperties, environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("hikari.password");
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "springdoc.api-docs.enabled", "springdoc.swagger-ui.enabled"
    })
    void rejects_production_documentation_reenabled_by_external_configuration(String property) {
        MockEnvironment environment = safeProductionEnvironment().withProperty(property, "true");

        assertThatThrownBy(() -> validator(safeProductionProperties(),
                "db-P8$f6D4s2A0z9X7v5N3", environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Swagger and OpenAPI");
    }

    @Test
    void rejects_production_request_body_limit_above_one_mebibyte() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("app.web.max-request-body-size-bytes", "1048577");

        assertThatThrownBy(() -> validator(safeProductionProperties(),
                "db-P8$f6D4s2A0z9X7v5N3", environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("1048576");
    }

    @ParameterizedTest(name = "rejects unsafe database password: {0}")
    @MethodSource("unsafeDatabasePasswords")
    void rejects_unsafe_database_passwords(String description, String password) {
        SecurityProperties properties = properties(
                "jwt-A9!c2E4g6I8k0M2o4Q6s8U0w2Y4z6B8d",
                "internal-Z7@x5V3t1R9p7N5l3J1h9F7d5S3a1Q");

        assertThatThrownBy(() -> validator(properties, password).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DB_PASSWORD");
    }

    private static Stream<Arguments> unsafeSecrets() {
        String safeJwt = "jwt-A9!c2E4g6I8k0M2o4Q6s8U0w2Y4z6B8d";
        String safeInternal = "internal-Z7@x5V3t1R9p7N5l3J1h9F7d5S3a1Q";
        return Stream.of(
                Arguments.of("missing jwt", "", safeInternal, "JWT_SECRET"),
                Arguments.of("missing internal key", safeJwt, " ", "INTERNAL_KEY"),
                Arguments.of("short jwt", "too-short", safeInternal, "JWT_SECRET"),
                Arguments.of("short internal key", safeJwt, "also-too-short", "INTERNAL_KEY"),
                Arguments.of("development jwt", "erp-approid-dev-secret-key-change-in-production-32bytes",
                        safeInternal, "JWT_SECRET"),
                Arguments.of("generic dev jwt", "service-dev-secret-value-longer-than-thirty-two-bytes",
                        safeInternal, "JWT_SECRET"),
                Arguments.of("example internal key", safeJwt,
                        "example-internal-key-that-is-not-production-safe", "INTERNAL_KEY"),
                Arguments.of("equal secrets", safeJwt, safeJwt, "different"));
    }

    private static Stream<Arguments> unsafeDatabasePasswords() {
        return Stream.of(
                Arguments.of("missing", ""),
                Arguments.of("short", "short-db-pass"),
                Arguments.of("local development default", "erp_dev_pw"),
                Arguments.of("documented local-only example", "erp_local_only_change_me"),
                Arguments.of("example", "example-database-password"));
    }

    private static Stream<Arguments> invalidProfileCombinations() {
        return Stream.of(
                Arguments.of("prod", "test"),
                Arguments.of("prod", "local"),
                Arguments.of("local", "test"));
    }

    private static SecurityProperties properties(String jwtSecret, String internalKey) {
        SecurityProperties properties = new SecurityProperties();
        properties.getJwt().setSecret(jwtSecret);
        properties.setInternalKey(internalKey);
        properties.getCors().setAllowedOrigins(List.of("https://erp.example.com"));
        return properties;
    }

    private static SecurityProperties safeProductionProperties() {
        return properties(
                "jwt-A9!c2E4g6I8k0M2o4Q6s8U0w2Y4z6B8d",
                "internal-Z7@x5V3t1R9p7N5l3J1h9F7d5S3a1Q");
    }

    private static ProductionSecurityValidator validator(SecurityProperties properties,
                                                          String databasePassword) {
        return validator(properties, databasePassword, safeProductionEnvironment());
    }

    private static ProductionSecurityValidator validator(SecurityProperties properties,
                                                          String databasePassword,
                                                          MockEnvironment environment) {
        DataSourceProperties dataSourceProperties = new DataSourceProperties();
        dataSourceProperties.setPassword(databasePassword);
        return new ProductionSecurityValidator(properties, dataSourceProperties, environment);
    }

    private static MockEnvironment safeProductionEnvironment() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("springdoc.api-docs.enabled", "false")
                .withProperty("springdoc.swagger-ui.enabled", "false")
                .withProperty("app.web.max-request-body-size-bytes", "1048576");
        environment.setActiveProfiles("prod");
        return environment;
    }

    private static ProductionSecurityValidator validatorWithProfiles(String... profiles) {
        SecurityProperties properties = new SecurityProperties();
        DataSourceProperties dataSourceProperties = new DataSourceProperties();
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profiles);
        return new ProductionSecurityValidator(properties, dataSourceProperties, environment);
    }
}
