package com.erpapproid.core.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findByUsername(String username);

    boolean existsByUsername(String username);

    @Query("""
            select u from UserEntity u
            join fetch u.roles
            where u.username = :username
            """)
    Optional<UserEntity> findByUsernameWithRoles(String username);
}
