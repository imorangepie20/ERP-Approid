package com.erpapproid.core.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class CurrentActorProviderTest {

    private final CurrentActorProvider provider = new CurrentActorProvider();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void exposes_authenticated_user_as_current_actor_and_jpa_auditor() {
        UserPrincipal principal = UserPrincipal.of(42L, "admin", "Admin", "secret", Set.of("ADMIN"));
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));

        assertThat(provider.currentActorId()).contains(42L);
        assertThat(provider.getCurrentAuditor()).contains(42L);
    }

    @Test
    void returns_empty_for_missing_or_non_user_authentication() {
        assertThat(provider.currentActorId()).isEmpty();

        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("system", null, java.util.List.of()));
        assertThat(provider.currentActorId()).isEmpty();
    }
}
