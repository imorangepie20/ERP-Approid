package com.erpapproid.core.domain.sales;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long> {

    Optional<ShipmentEntity> findByShipmentNo(String shipmentNo);

    @Query("""
            select s from ShipmentEntity s
            where (:status is null or s.status = :status)
              and (:customerId is null or s.customer.id = :customerId)
              and (:keyword is null or lower(s.shipmentNo) like lower(concat('%', :keyword, '%')))
            """)
    Page<ShipmentEntity> search(String status, Long customerId, String keyword, Pageable pageable);
}
