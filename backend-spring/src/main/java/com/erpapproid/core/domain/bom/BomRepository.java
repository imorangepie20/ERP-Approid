package com.erpapproid.core.domain.bom;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BomRepository extends JpaRepository<BomEntity, Long> {

    List<BomEntity> findByParentId(Long parentId);

    List<BomEntity> findByChildId(Long childId);

    boolean existsByParentIdAndChildId(Long parentId, Long childId);

    long countByParentId(Long parentId);

    long countByChildId(Long childId);
}
