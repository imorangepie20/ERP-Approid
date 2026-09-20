package com.erpapproid.core.security;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * /api/core/internal/** FastAPI → Spring 내부 호출 인증.
 * api-spec.md 9: X-Internal-Key 불일치 → 401
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InternalKeyFilter extends OncePerRequestFilter {

    private static final String INTERNAL_PATH = "/api/core/internal/";
    private static final String INTERNAL_HEADER = "X-Internal-Key";

    private final SecurityProperties properties;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (path == null || !path.contains(INTERNAL_PATH)) {
            filterChain.doFilter(request, response);
            return;
        }
        String key = request.getHeader(INTERNAL_HEADER);
        String expected = properties.getInternalKey();
        if (expected == null || expected.isBlank() || !expected.equals(key)) {
            log.warn("invalid internal key for path {}", path);
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write("""
                    {"code":"UNAUTHORIZED","message":"내부 호출 키가 유효하지 않습니다."}\
                    """);
            return;
        }
        filterChain.doFilter(request, response);
    }
}
