package com.erpapproid.core.domain.purchase;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrderEntity, Long> {

    Optional<PurchaseOrderEntity> findByPurchaseOrderNo(String purchaseOrderNo);

    @Query("""
            select p from PurchaseOrderEntity p
            where (:status is null or p.status = :status)
              and (:vendorId is null or p.vendor.id = :vendorId)
            """)
    org.springframework.data.domain.Page<PurchaseOrderEntity> search(String status, Long vendorId,
                                                                    org.springframework.data.domain.Pageable pageable);

    List<PurchaseOrderEntity> findByVendorId(Long vendorId);

    boolean existsByVendor_Id(Long vendorId);
}
