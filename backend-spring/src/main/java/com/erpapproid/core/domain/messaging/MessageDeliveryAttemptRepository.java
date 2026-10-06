package com.erpapproid.core.domain.messaging;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageDeliveryAttemptRepository extends JpaRepository<MessageDeliveryAttemptEntity, Long> {
    Page<MessageDeliveryAttemptEntity> findByMessage_Id(UUID messageId, Pageable pageable);
}
