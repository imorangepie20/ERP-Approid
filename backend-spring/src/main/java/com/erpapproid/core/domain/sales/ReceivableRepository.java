package com.erpapproid.core.domain.sales;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ReceivableRepository extends JpaRepository<ReceivableEntity, Long> {

    @Query("""
            select r from ReceivableEntity r
            where (:status is null or r.status = :status)
              and (:customerId is null or r.customer.id = :customerId)
            """)
    Page<ReceivableEntity> search(String status, Long customerId, Pageable pageable);

    @Query("""
            select coalesce(sum(r.amount), 0) from ReceivableEntity r
            where r.status <> '수납완료'
            """)
    Long sumOpenAmount();

    @Query("""
            select coalesce(sum(r.amount), 0) from ReceivableEntity r
            where r.status <> '수납완료' and r.dueDate < current_date
            """)
    Long sumOverdueAmount();

    long countByStatusNot(String status);

    @Query("""
            select count(r) from ReceivableEntity r
            where r.status <> '수납완료' and r.dueDate < current_date
            """)
    long countOverdue();

    List<ReceivableEntity> findBySalesOrderId(Long salesOrderId);
}
