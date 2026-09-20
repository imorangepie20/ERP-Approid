package com.erpapproid.core.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<RoleEntity, Long> {

    java.util.Optional<RoleEntity> findByCode(String code);
}
