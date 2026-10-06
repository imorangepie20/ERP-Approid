package com.erpapproid.core.domain.sales;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReceivableCollectionRepository extends JpaRepository<ReceivableCollectionEntity, Long> {
    Optional<ReceivableCollectionEntity> findByReceivable_IdAndRequestId(Long receivableId, UUID requestId);
    Page<ReceivableCollectionEntity> findByReceivable_Id(Long receivableId, Pageable pageable);
}
