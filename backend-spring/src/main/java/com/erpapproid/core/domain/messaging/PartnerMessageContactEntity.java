package com.erpapproid.core.domain.messaging;

import java.time.Instant;
import com.erpapproid.core.common.entity.BaseEntity;
import com.erpapproid.core.domain.partner.PartnerEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Table(name = "partner_message_contacts")
public class PartnerMessageContactEntity extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "partner_id", nullable = false, updatable = false)
    private PartnerEntity partner;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, updatable = false, length = 32)
    private MessagePurpose purpose = MessagePurpose.RECEIVABLE_REMINDER;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, updatable = false, length = 16)
    private MessageChannel channel = MessageChannel.EMAIL;

    @Column(name = "email", nullable = false, length = 254)
    private String email;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "permission", nullable = false, length = 16)
    private MessagePermission permission = MessagePermission.PENDING;

    @Column(name = "confirmation_note", length = 256)
    private String confirmationNote;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    public void revise(String email, MessagePermission permission, String note, Long actorId, Instant at) {
        this.email = email;
        this.permission = permission;
        this.confirmationNote = note;
        this.confirmedBy = actorId;
        this.confirmedAt = at;
    }
}
