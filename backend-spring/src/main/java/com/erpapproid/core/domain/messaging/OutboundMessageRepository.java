package com.erpapproid.core.domain.messaging;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboundMessageRepository extends JpaRepository<OutboundMessageEntity, UUID> {
    boolean existsByReceivable_IdAndStateIn(Long receivableId, java.util.Collection<MessageState> states);
    boolean existsByReceivable_IdAndStateAndAcceptedOn(Long receivableId, MessageState state, java.time.LocalDate date);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from OutboundMessageEntity m where m.id = :id")
    java.util.Optional<OutboundMessageEntity> findForUpdate(UUID id);

    Page<OutboundMessageEntity> findByReceivable_Id(Long receivableId, Pageable pageable);
}
