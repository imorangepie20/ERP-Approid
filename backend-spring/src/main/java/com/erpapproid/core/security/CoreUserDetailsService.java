package com.erpapproid.core.security;

import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.erpapproid.core.domain.user.UserEntity;
import com.erpapproid.core.domain.user.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CoreUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다: " + username));
        if (!"활성".equals(user.getStatus())) {
            throw new UsernameNotFoundException("비활성 사용자입니다: " + username);
        }
        Set<String> roles = user.getRoles().stream()
                .map(com.erpapproid.core.domain.user.RoleEntity::getCode)
                .collect(Collectors.toSet());
        return UserPrincipal.of(user.getId(), user.getUsername(), user.getName(),
                user.getPasswordHash(), roles);
    }
}
