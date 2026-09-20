package com.erpapproid.core.security;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String username;
    private final String name;
    private final String password;
    private final Set<String> roles;
    private final Collection<? extends GrantedAuthority> authorities;

    public static UserPrincipal of(Long id, String username, String name, String password,
                                   Set<String> roles) {
        List<GrantedAuthority> authorities = roles.stream()
                .map(r -> new org.springframework.security.core.authority
                        .SimpleGrantedAuthority("ROLE_" + r))
                .collect(Collectors.toList());
        return new UserPrincipal(id, username, name, password, roles, authorities);
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
