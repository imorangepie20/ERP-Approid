package com.erpapproid.core.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.time.Instant;
import java.util.Date;
import java.util.stream.Collectors;

import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.beans.factory.annotation.Autowired;

import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.user.RoleEntity;
import com.erpapproid.core.domain.user.UserEntity;
import com.erpapproid.core.support.IntegrationTestSupport;
import com.erpapproid.core.security.SecurityProperties;

import io.jsonwebtoken.Jwts;

class AuthIntegrationTest extends IntegrationTestSupport {

    private static final int JWT_EXPIRATION_MINUTES = 37;

    @Autowired
    private SecurityProperties securityProperties;

    @DynamicPropertySource
    static void configureJwtExpiration(DynamicPropertyRegistry registry) {
        registry.add("app.security.jwt.expiration-minutes", () -> JWT_EXPIRATION_MINUTES);
    }

    @Test
    void login_and_me_return_the_current_user() {
        ResponseEntity<JsonNode> login = post("/api/core/auth/login",
                body("username", ADMIN_USERNAME, "password", ADMIN_PASSWORD));

        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login.getBody()).isNotNull();
        String token = login.getBody().get("accessToken").asText();

        ResponseEntity<JsonNode> me = get("/api/core/auth/me", token);

        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(me.getBody()).isNotNull();
        assertThat(me.getBody().get("username").asText()).isEqualTo(ADMIN_USERNAME);
        assertThat(me.getBody().get("roles")).extracting(JsonNode::asText).containsExactly("ADMIN");
    }

    @Test
    void login_expires_in_matches_the_configured_jwt_expiration() {
        ResponseEntity<JsonNode> response = post("/api/core/auth/login",
                body("username", ADMIN_USERNAME, "password", ADMIN_PASSWORD));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("expiresIn").asLong())
                .isEqualTo(JWT_EXPIRATION_MINUTES * 60L);
    }

    @Test
    void request_uses_current_database_roles_instead_of_stale_token_claims() {
        String username = "role-refresh";
        createUser(username, "password123", "SALES");
        String token = login(username, "password123");

        UserEntity user = userRepository.findByUsernameWithRoles(username).orElseThrow();
        Set<RoleEntity> materialRole = roleRepository.findAll().stream()
                .filter(role -> "MATERIAL".equals(role.getCode()))
                .collect(Collectors.toSet());
        user.setRoles(materialRole);
        userRepository.saveAndFlush(user);

        ResponseEntity<JsonNode> me = get("/api/core/auth/me", token);

        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(me.getBody()).isNotNull();
        assertThat(me.getBody().get("roles")).extracting(JsonNode::asText).containsExactly("MATERIAL");

        ResponseEntity<JsonNode> forbidden = post("/api/core/partners", token,
                body("partnerType", "고객사", "partnerNo", "C-TOKEN-ROLE",
                        "name", "권한 갱신 테스트", "paymentTerms", 30));
        assertThat(forbidden.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(forbidden.getBody()).isNotNull();
        assertThat(forbidden.getBody().get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    void token_for_an_inactive_user_is_rejected() {
        String username = "inactive-after-login";
        createUser(username, "password123", "SALES");
        String token = login(username, "password123");

        UserEntity user = userRepository.findByUsername(username).orElseThrow();
        user.setStatus("잠김");
        userRepository.saveAndFlush(user);

        ResponseEntity<JsonNode> response = get("/api/core/auth/me", token);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void invalid_token_preserves_the_common_unauthorized_contract() {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/auth/me", HttpMethod.GET, authEntity("not-a-jwt", null), JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void expired_signed_token_preserves_the_common_unauthorized_contract() {
        byte[] secret = securityProperties.getJwt().getSecret()
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String expiredToken = Jwts.builder()
                .subject(ADMIN_USERNAME)
                .issuedAt(Date.from(Instant.now().minusSeconds(120)))
                .expiration(Date.from(Instant.now().minusSeconds(60)))
                .signWith(new SecretKeySpec(secret, "HmacSHA256"))
                .compact();

        ResponseEntity<JsonNode> response = get("/api/core/auth/me", expiredToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("UNAUTHORIZED");
    }
}
