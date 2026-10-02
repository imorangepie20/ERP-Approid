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

public interface QuotationRepository extends JpaRepository<QuotationEntity, Long>, JpaSpecificationExecutor<QuotationEntity> {

    boolean existsByQuotationNo(String quotationNo);

    @Override
    @EntityGraph(attributePaths = {"customer", "item"})
    Page<QuotationEntity> findAll(Specification<QuotationEntity> spec, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from QuotationEntity q where q.id = :id")
    Optional<QuotationEntity> findForUpdate(Long id);

    boolean existsByCustomer_Id(Long customerId);

    Optional<QuotationEntity> findByQuotationNo(String quotationNo);

    @Query("""
            select q from QuotationEntity q
            where (:status is null or q.status = :status)
              and (:keyword is null or lower(q.quotationNo) like lower(concat('%', :keyword, '%')))
            """)
    Page<QuotationEntity> search(String status, String keyword, Pageable pageable);
}
