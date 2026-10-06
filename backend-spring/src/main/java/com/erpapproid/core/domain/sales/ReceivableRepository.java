package com.erpapproid.core.domain.sales;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

public interface ReceivableRepository extends JpaRepository<ReceivableEntity, Long> {

    boolean existsByCustomer_Id(Long customerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ReceivableEntity r where r.id = :id")
    Optional<ReceivableEntity> findForUpdate(Long id);

    @EntityGraph(attributePaths = {"customer", "salesOrder"})
    @Query("""
            select r from ReceivableEntity r
            left join r.salesOrder o
            where (:status is null or r.status = :status)
              and (:customerId is null or r.customer.id = :customerId)
              and (cast(:keyword as String) is null
                   or lower(r.receivableNo) like :keyword escape '!'
                   or lower(r.customer.name) like :keyword escape '!'
                   or lower(o.salesOrderNo) like :keyword escape '!')
              and (:overdue is null
                   or (:overdue = true and r.status <> '수납완료' and r.amount > r.collectedAmount and r.dueDate < :today)
                   or (:overdue = false and (r.status = '수납완료' or r.amount <= r.collectedAmount or r.dueDate >= :today)))
            """)
    Page<ReceivableEntity> search(String status, Long customerId, String keyword, Boolean overdue,
            LocalDate today, Pageable pageable);

    @Query("""
            select coalesce(sum(r.amount), 0) from ReceivableEntity r
            where r.status <> '수납완료'
            """)
    Long sumOpenAmount();

    @Query("select coalesce(sum(r.amount - r.collectedAmount), 0) from ReceivableEntity r where r.status <> '수납완료'")
    Long sumOpenBalance();

    @Query("select coalesce(sum(r.amount - r.collectedAmount), 0) from ReceivableEntity r where r.status <> '수납완료' and r.amount > r.collectedAmount and r.dueDate < :today")
    Long sumOverdueBalance(LocalDate today);

    @Query("""
            select coalesce(sum(r.amount), 0) from ReceivableEntity r
            where r.status <> '수납완료' and r.amount > r.collectedAmount and r.dueDate < :today
            """)
    Long sumOverdueAmount(LocalDate today);

    long countByStatusNot(String status);

    @Query("""
            select count(r) from ReceivableEntity r
            where r.status <> '수납완료' and r.amount > r.collectedAmount and r.dueDate < :today
            """)
    long countOverdue(LocalDate today);

    List<ReceivableEntity> findBySalesOrderId(Long salesOrderId);
}
