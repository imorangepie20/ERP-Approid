package com.erpapproid.core.domain.production;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductionPlanRepository extends JpaRepository<ProductionPlanEntity, Long> {

    @Query("""
            select p from ProductionPlanEntity p
            where (:planMonth is null or p.planMonth = :planMonth)
              and (:status is null or p.status = :status)
            """)
    Page<ProductionPlanEntity> search(String planMonth, String status, Pageable pageable);

    boolean existsByItemIdAndPlanMonth(Long itemId, String planMonth);

    List<ProductionPlanEntity> findByPlanMonth(String planMonth);
}
