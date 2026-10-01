package com.erpapproid.core.security;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.erpapproid.core.domain.user.UserRepository;

import lombok.RequiredArgsConstructor;

@Component
@Profile("prod")
@RequiredArgsConstructor
public class ProductionAdminValidator implements SmartInitializingSingleton {

    private static final String DEVELOPMENT_ADMIN_PASSWORD = "admin123";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void afterSingletonsInstantiated() {
        boolean unsafeAdminExists = userRepository.findAll().stream()
                .filter(user -> "활성".equals(user.getStatus()))
                .filter(user -> user.getRoles().stream()
                        .anyMatch(role -> "ADMIN".equals(role.getCode())))
                .anyMatch(user -> passwordEncoder.matches(
                        DEVELOPMENT_ADMIN_PASSWORD, user.getPasswordHash()));
        if (unsafeAdminExists) {
            throw new IllegalStateException(
                    "Production startup refused: replace the development ADMIN credential");
        }
    }
}
