package com.erpapproid.core.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.erpapproid.core.domain.user.RoleEntity;
import com.erpapproid.core.domain.user.UserEntity;
import com.erpapproid.core.domain.user.UserRepository;

class ProductionAdminValidatorTest {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final ProductionAdminValidator validator =
            new ProductionAdminValidator(userRepository, passwordEncoder);

    @Test
    void rejects_active_admin_with_the_seeded_development_password() {
        when(userRepository.findAll()).thenReturn(List.of(user(
                "활성", "ADMIN", passwordEncoder.encode("admin123"))));

        assertThatThrownBy(validator::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("development ADMIN credential");
    }

    @Test
    void accepts_admin_after_password_rotation() {
        when(userRepository.findAll()).thenReturn(List.of(user(
                "활성", "ADMIN", passwordEncoder.encode("unique-production-password"))));

        assertThatCode(validator::afterSingletonsInstantiated)
                .doesNotThrowAnyException();
    }

    @Test
    void ignores_non_admin_and_inactive_accounts() {
        when(userRepository.findAll()).thenReturn(List.of(
                user("활성", "SALES", passwordEncoder.encode("admin123")),
                user("비활성", "ADMIN", passwordEncoder.encode("admin123"))));

        assertThatCode(validator::afterSingletonsInstantiated)
                .doesNotThrowAnyException();
    }

    private static UserEntity user(String status, String roleCode, String passwordHash) {
        RoleEntity role = RoleEntity.builder().code(roleCode).name(roleCode).build();
        return UserEntity.builder()
                .username("operator")
                .passwordHash(passwordHash)
                .name("운영자")
                .status(status)
                .roles(Set.of(role))
                .build();
    }
}
