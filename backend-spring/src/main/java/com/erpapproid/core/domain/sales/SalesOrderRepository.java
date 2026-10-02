package com.erpapproid.core.domain.sales;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.LockModeType;

import java.util.Optional;

public interface SalesOrderRepository extends JpaRepository<SalesOrderEntity, Long>, JpaSpecificationExecutor<SalesOrderEntity> {

    boolean existsBySalesOrderNo(String salesOrderNo);
    boolean existsByQuotationId(Long quotationId);

    @Override
    @EntityGraph(attributePaths = {"customer", "item", "quotation"})
    Page<SalesOrderEntity> findAll(Specification<SalesOrderEntity> spec, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SalesOrderEntity s where s.id = :id")
    Optional<SalesOrderEntity> findForUpdate(Long id);

    Optional<SalesOrderEntity> findBySalesOrderNo(String salesOrderNo);

    @Query("""
            select s from SalesOrderEntity s
            where (:status is null or s.status = :status)
              and (:customerId is null or s.customer.id = :customerId)
              and (:keyword is null or lower(s.salesOrderNo) like lower(concat('%', :keyword, '%')))
            """)
    Page<SalesOrderEntity> search(String status, Long customerId, String keyword, Pageable pageable);

    long countByStatus(String status);

    boolean existsByCustomer_Id(Long customerId);
}
