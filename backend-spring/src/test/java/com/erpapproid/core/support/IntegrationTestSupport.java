package com.erpapproid.core.support;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.user.RoleEntity;
import com.erpapproid.core.domain.user.RoleRepository;
import com.erpapproid.core.domain.user.UserEntity;
import com.erpapproid.core.domain.user.UserRepository;

/**
 * Testcontainers (PostgreSQL 16) 기반 통합 테스트 베이스.
 * Flyway V1~V7 마이그레이션과 시드 데이터가 그대로 적용된다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
public abstract class IntegrationTestSupport {

    protected static final String ADMIN_USERNAME = "admin";
    protected static final String ADMIN_PASSWORD = "admin123";
    private static final String DEFAULT_NAME = "테스트 사용자";

    @Container
    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("erp_approid")
                    .withUsername("erp")
                    .withPassword("erp_dev_pw");

    static {
        // @TestInstance(PER_CLASS) 테스트에서 SpringExtension 가 컨텍스트를
        // Testcontainers beforeAll 보다 먼저 로드하더라도 컨테이너가 동작 중이도록
        // 클래스 초기화 시점에 즉시 시작한다.
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void overrideDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    protected TestRestTemplate rest;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected RoleRepository roleRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    private final Map<String, String> tokenCache = new LinkedHashMap<>();

    protected String loginAdmin() {
        return login(ADMIN_USERNAME, ADMIN_PASSWORD);
    }

    protected String login(String username, String password) {
        return tokenCache.computeIfAbsent(username, user -> {
            ResponseEntity<JsonNode> response = rest.exchange(
                    "/api/core/auth/login", HttpMethod.POST, jsonEntity(body(
                            "username", user, "password", password)), JsonNode.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("로그인 실패: " + user + " -> " + response.getStatusCode());
            }
            return response.getBody().get("accessToken").asText();
        });
    }

    protected void createUser(String username, String password, String... roleCodes) {
        if (userRepository.existsByUsername(username)) {
            return;
        }
        Set<RoleEntity> roles = roleRepository.findAll().stream()
                .filter(role -> java.util.Arrays.asList(roleCodes).contains(role.getCode()))
                .collect(Collectors.toSet());
        UserEntity user = UserEntity.builder()
                .username(username)
                .passwordHash(passwordEncoder.encode(password))
                .name(DEFAULT_NAME)
                .email(username + "@erpapproid.local")
                .employeeNo("EMP-T-" + username.toUpperCase())
                .status("활성")
                .roles(roles)
                .build();
        userRepository.save(user);
    }

    protected HttpEntity<?> jsonEntity(Object requestBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(requestBody, headers);
    }

    protected HttpEntity<?> authEntity(String token, Object requestBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        return new HttpEntity<>(requestBody, headers);
    }

    protected ResponseEntity<JsonNode> get(String path, String token) {
        return rest.exchange(path, HttpMethod.GET, authEntity(token, null), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> post(String path, String token, Object requestBody) {
        return rest.exchange(path, HttpMethod.POST, authEntity(token, requestBody), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> post(String path, Object requestBody) {
        return rest.exchange(path, HttpMethod.POST, jsonEntity(requestBody), JsonNode.class);
    }

    protected static Map<String, Object> body(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put((String) keyValues[i], keyValues[i + 1]);
        }
        return map;
    }
}
