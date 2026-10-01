package com.erpapproid.core.domain.purchase;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ReceivingRepository extends JpaRepository<ReceivingEntity, Long> {

    boolean existsByVendor_Id(Long vendorId);

    @Query("""
            select r from ReceivingEntity r
            where (:purchaseOrderId is null or r.purchaseOrder.id = :purchaseOrderId)
              and (:status is null or r.status = :status)
            """)
    Page<ReceivingEntity> search(Long purchaseOrderId, String status, Pageable pageable);

    List<ReceivingEntity> findByPurchaseOrderId(Long purchaseOrderId);
}
