package com.erpapproid.core.security;

import java.io.IOException;

import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String AUTHENTICATED_USER_ATTRIBUTE =
            JwtAuthenticationFilter.class.getName() + ".authenticatedUser";
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider tokenProvider;
    private final CoreUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String token = resolveToken(request);
            if (token != null) {
                authenticate(request, token);
            }
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("user");
        }
    }

    private void authenticate(HttpServletRequest request, String token) {
        String username;
        try {
            username = tokenProvider.claims(token).getSubject();
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("JWT authentication rejected");
            SecurityContextHolder.clearContext();
            return;
        }
        if (!StringUtils.hasText(username)) {
            log.debug("JWT authentication rejected because the subject is missing");
            SecurityContextHolder.clearContext();
            return;
        }

        UserPrincipal principal;
        try {
            principal = userDetailsService.loadUserByUsername(username);
        } catch (UsernameNotFoundException ex) {
            log.debug("JWT subject user is not available");
            SecurityContextHolder.clearContext();
            return;
        }

        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        MDC.put("user", username);
        request.setAttribute(AUTHENTICATED_USER_ATTRIBUTE, username);
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(header) && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
