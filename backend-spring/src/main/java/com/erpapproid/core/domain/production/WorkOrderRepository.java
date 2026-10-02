package com.erpapproid.core.domain.production;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface WorkOrderRepository extends JpaRepository<WorkOrderEntity, Long>, JpaSpecificationExecutor<WorkOrderEntity> {

    boolean existsByWorkOrderNo(String workOrderNo);

    @Override
    @EntityGraph(attributePaths = {"item", "salesOrder"})
    Page<WorkOrderEntity> findAll(Specification<WorkOrderEntity> spec, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from WorkOrderEntity w where w.id = :id")
    Optional<WorkOrderEntity> findForUpdate(Long id);

    Optional<WorkOrderEntity> findByWorkOrderNo(String workOrderNo);

    @Query("""
            select w from WorkOrderEntity w
            where (:status is null or w.status = :status)
              and (:itemId is null or w.item.id = :itemId)
              and (:keyword is null or lower(w.workOrderNo) like lower(concat('%', :keyword, '%')))
            """)
    Page<WorkOrderEntity> search(String status, Long itemId, String keyword, Pageable pageable);

    @Query("""
            select w from WorkOrderEntity w
            where w.status in ('지시', '진행중')
            order by w.dueDate asc
            """)
    List<WorkOrderEntity> findActive();

    long countByStatus(String status);

    List<WorkOrderEntity> findBySalesOrderId(Long salesOrderId);

    @Query(value = """
            select exists(select 1 from work_orders w, jsonb_array_elements(w.routing_steps) step
                          where (step->>'routingId')::bigint = :routingId)
            """, nativeQuery = true)
    boolean referencesRouting(Long routingId);
}
