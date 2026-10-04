package com.erpapproid.core.domain.sales;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<ShipmentEntity> {

    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"salesOrder", "customer", "item", "lot", "inventoryTransaction", "receivable"})
    Page<ShipmentEntity> findAll(org.springframework.data.jpa.domain.Specification<ShipmentEntity> spec, Pageable pageable);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ShipmentEntity s where s.id = :id")
    Optional<ShipmentEntity> findForUpdate(Long id);

    @Query("select coalesce(sum(s.qty),0) from ShipmentEntity s where s.salesOrder.id = :orderId and s.status <> '취소' and (:excludeId is null or s.id <> :excludeId)")
    java.math.BigDecimal allocatedQty(Long orderId, Long excludeId);

    @Query("select coalesce(sum(s.qty),0) from ShipmentEntity s where s.salesOrder.id = :orderId and s.status in ('출하완료','매출반영')")
    java.math.BigDecimal confirmedQty(Long orderId);

    @Query("select coalesce(sum(s.amount),0) from ShipmentEntity s where s.salesOrder.id = :orderId and s.status in ('출하완료','매출반영')")
    Long confirmedAmount(Long orderId);

    boolean existsByCustomer_Id(Long customerId);

    Optional<ShipmentEntity> findByShipmentNo(String shipmentNo);

    @Query("""
            select s from ShipmentEntity s
            where (:status is null or s.status = :status)
              and (:customerId is null or s.customer.id = :customerId)
              and (:keyword is null or lower(s.shipmentNo) like lower(concat('%', :keyword, '%')))
            """)
    Page<ShipmentEntity> search(String status, Long customerId, String keyword, Pageable pageable);
}
