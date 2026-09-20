package com.erpapproid.core.security;

import java.time.Instant;
import java.util.Date;
import java.util.List;

import javax.crypto.spec.SecretKeySpec;

import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    private final SecurityProperties properties;

    private SecretKeySpec key() {
        byte[] secret = properties.getJwt().getSecret().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return new SecretKeySpec(secret, "HmacSHA256");
    }

    public String createToken(UserDetails userDetails) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(properties.getJwt().getExpirationMinutes() * 60L);
        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        return Jwts.builder()
                .subject(userDetails.getUsername())
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key())
                .compact();
    }

    public String createToken(String username, List<String> roles) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(properties.getJwt().getExpirationMinutes() * 60L);
        return Jwts.builder()
                .subject(username)
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key())
                .compact();
    }

    public Jws<Claims> parse(String token) {
        return Jwts.parser()
                .verifyWith(key())
                .build()
                .parseSignedClaims(token);
    }

    public Claims claims(String token) {
        return parse(token).getPayload();
    }

    @Async
    public void logTokenIssue(String username) {
        log.debug("JWT issued for user {}", username);
    }
}
