package com.erpapproid.core.domain.routing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface RoutingRepository extends JpaRepository<RoutingEntity, Long>, JpaSpecificationExecutor<RoutingEntity> {

    boolean existsByRoutingNo(String routingNo);

    boolean existsByItemIdAndSeqAndIdNot(Long itemId, Integer seq, Long id);

    List<RoutingEntity> findByItemIdOrderBySeqAsc(Long itemId);

    List<RoutingEntity> findByItemId(Long itemId);

    boolean existsByItemIdAndSeq(Long itemId, Integer seq);

    long countByItemId(Long itemId);
}
