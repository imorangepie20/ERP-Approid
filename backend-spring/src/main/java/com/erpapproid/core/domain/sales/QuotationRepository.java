package com.erpapproid.core.domain.sales;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface QuotationRepository extends JpaRepository<QuotationEntity, Long> {

    Optional<QuotationEntity> findByQuotationNo(String quotationNo);

    @Query("""
            select q from QuotationEntity q
            where (:status is null or q.status = :status)
              and (:keyword is null or lower(q.quotationNo) like lower(concat('%', :keyword, '%')))
            """)
    Page<QuotationEntity> search(String status, String keyword, Pageable pageable);
}
