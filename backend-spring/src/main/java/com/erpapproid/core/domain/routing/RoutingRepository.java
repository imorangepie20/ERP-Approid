package com.erpapproid.core.domain.routing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoutingRepository extends JpaRepository<RoutingEntity, Long> {

    List<RoutingEntity> findByItemId(Long itemId);

    boolean existsByItemIdAndSeq(Long itemId, Integer seq);

    long countByItemId(Long itemId);
}
