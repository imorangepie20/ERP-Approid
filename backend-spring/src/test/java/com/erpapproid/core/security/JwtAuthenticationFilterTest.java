package com.erpapproid.core.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtTokenProvider tokenProvider;
    @Mock
    private CoreUserDetailsService userDetailsService;
    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;
    @Mock
    private FilterChain filterChain;

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(tokenProvider, userDetailsService);
        when(request.getHeader("Authorization")).thenReturn("Bearer token");
    }

    @AfterEach
    void cleanSecurityState() {
        SecurityContextHolder.clearContext();
        MDC.remove("user");
    }

    @Test
    void malformed_token_remains_anonymous_and_continues_the_chain() throws Exception {
        when(tokenProvider.claims("token")).thenThrow(new MalformedJwtException("secret raw detail"));

        filter.doFilterInternal(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void missing_user_remains_anonymous_and_continues_the_chain() throws Exception {
        Claims claims = claims("missing");
        when(tokenProvider.claims("token")).thenReturn(claims);
        when(userDetailsService.loadUserByUsername("missing"))
                .thenThrow(new UsernameNotFoundException("missing"));

        filter.doFilterInternal(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void database_failure_is_propagated_instead_of_becoming_unauthorized() {
        Claims claims = claims("admin");
        when(tokenProvider.claims("token")).thenReturn(claims);
        DataAccessResourceFailureException failure = new DataAccessResourceFailureException("database unavailable");
        when(userDetailsService.loadUserByUsername("admin")).thenThrow(failure);

        assertThatThrownBy(() -> filter.doFilterInternal(request, response, filterChain))
                .isSameAs(failure);
        verifyNoInteractions(filterChain);
    }

    @Test
    void authenticated_user_is_available_during_the_chain_and_removed_from_mdc_afterward() throws Exception {
        Claims claims = claims("admin");
        when(tokenProvider.claims("token")).thenReturn(claims);
        when(userDetailsService.loadUserByUsername("admin"))
                .thenReturn(UserPrincipal.of(1L, "admin", "관리자", "hash", Set.of("ADMIN")));
        org.mockito.Mockito.doAnswer(invocation -> {
            assertThat(MDC.get("user")).isEqualTo("admin");
            return null;
        }).when(filterChain).doFilter(request, response);

        filter.doFilterInternal(request, response, filterChain);

        assertThat(MDC.get("user")).isNull();
    }

    private Claims claims(String subject) {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn(subject);
        return claims;
    }
}
