package com.erpapproid.core.domain.bom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface BomRepository extends JpaRepository<BomEntity, Long>, JpaSpecificationExecutor<BomEntity> {

    boolean existsByBomNo(String bomNo);

    List<BomEntity> findByParentId(Long parentId);

    List<BomEntity> findByChildId(Long childId);

    boolean existsByParentIdAndChildId(Long parentId, Long childId);

    long countByParentId(Long parentId);

    long countByChildId(Long childId);
}
