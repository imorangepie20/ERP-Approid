package com.erpapproid.core.domain.messaging;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartnerMessageContactRepository extends JpaRepository<PartnerMessageContactEntity, Long> {
    boolean existsByPartner_Id(Long partnerId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from PartnerMessageContactEntity c where c.partner.id = :partnerId and c.purpose = :purpose and c.channel = :channel")
    Optional<PartnerMessageContactEntity> findForUpdate(Long partnerId, MessagePurpose purpose, MessageChannel channel);

    Optional<PartnerMessageContactEntity> findByPartner_IdAndPurposeAndChannel(
            Long partnerId, MessagePurpose purpose, MessageChannel channel);
}
