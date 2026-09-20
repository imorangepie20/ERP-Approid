package com.erpapproid.core.api.auth;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.security.UserPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Tag(name = "auth", description = "인증")
@RestController
@RequestMapping("/api/core/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final com.erpapproid.core.security.JwtTokenProvider jwtTokenProvider;

    @Operation(summary = "로그인 및 JWT 발급")
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword());
        Authentication authentication = authenticationManager.authenticate(authToken);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        List<String> roles = principal.getRoles().stream().toList();
        String token = jwtTokenProvider.createToken(principal.getUsername(), roles);
        return ResponseEntity.ok(LoginResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(3600)
                .user(UserResponse.builder()
                        .id(principal.getId())
                        .username(principal.getUsername())
                        .name(principal.getName())
                        .roles(roles)
                        .build())
                .build());
    }

    @Operation(summary = "현재 사용자 정보")
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(UserResponse.builder()
                .id(principal.getId())
                .username(principal.getUsername())
                .name(principal.getName())
                .roles(principal.getRoles().stream().toList())
                .build());
    }

    @Getter
    public static class LoginRequest {
        @NotBlank
        private String username;
        @NotBlank
        private String password;
    }

    @Getter
    @Builder
    public static class UserResponse {
        private Long id;
        private String username;
        private String name;
        private List<String> roles;
    }

    @Getter
    @Builder
    public static class LoginResponse {
        private String accessToken;
        private String tokenType;
        private long expiresIn;
        private UserResponse user;
    }
}
