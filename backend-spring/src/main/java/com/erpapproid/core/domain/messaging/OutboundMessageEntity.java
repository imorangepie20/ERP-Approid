package com.erpapproid.core.domain.messaging;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.sales.ReceivableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
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
@Table(name = "outbound_messages")
public class OutboundMessageEntity {
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "request_id", nullable = false, updatable = false, unique = true)
    private UUID requestId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receivable_id", nullable = false, updatable = false)
    private ReceivableEntity receivable;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "partner_id", nullable = false, updatable = false)
    private PartnerEntity partner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contact_id", nullable = false, updatable = false)
    private PartnerMessageContactEntity contact;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;

    @Column(name = "trace_id", nullable = false, updatable = false, length = 128)
    private String traceId;

    @Column(name = "input_hash", nullable = false, updatable = false, length = 64)
    private String inputHash;

    @Column(name = "snapshot_hash", nullable = false, updatable = false, length = 64)
    private String snapshotHash;

    @Column(name = "template_version", nullable = false, updatable = false, length = 64)
    private String templateVersion;

    @Column(name = "recipient", nullable = false, updatable = false, length = 254)
    private String recipient;

    @Column(name = "subject", nullable = false, updatable = false, length = 256)
    private String subject;

    @Column(name = "body", nullable = false, updatable = false, columnDefinition = "text")
    private String body;

    @Builder.Default
    @Column(name = "note", nullable = false, updatable = false, length = 1000)
    private String note = "";

    @Column(name = "receivable_no", nullable = false, updatable = false, length = 32)
    private String receivableNo;

    @Column(name = "customer_name", nullable = false, updatable = false, length = 255)
    private String customerName;

    @Column(name = "receivable_status", nullable = false, updatable = false, length = 16)
    private String receivableStatus;

    @Column(name = "amount", nullable = false, updatable = false)
    private Long amount;

    @Column(name = "collected_amount", nullable = false, updatable = false)
    private Long collectedAmount;

    @Column(name = "remaining_amount", nullable = false, updatable = false)
    private Long remainingAmount;

    @Column(name = "due_date", nullable = false, updatable = false)
    private LocalDate dueDate;

    @Column(name = "reference_date", nullable = false, updatable = false)
    private LocalDate referenceDate;

    @Column(name = "contact_version", nullable = false, updatable = false)
    private Integer contactVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "contact_permission", nullable = false, updatable = false, length = 16)
    private MessagePermission contactPermission;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private Instant requestedAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "smtp_message_id", nullable = false, updatable = false, length = 255)
    private String smtpMessageId;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 32)
    private MessageState state = MessageState.QUEUED;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @Column(name = "claim_token")
    private UUID claimToken;

    @Column(name = "claim_until")
    private Instant claimUntil;

    @Builder.Default
    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount = 0;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "accepted_on")
    private LocalDate acceptedOn;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}
