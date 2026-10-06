package com.erpapproid.core.domain.sales;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Table(name = "receivable_collections")
public class ReceivableCollectionEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receivable_id", nullable = false, updatable = false)
    private ReceivableEntity receivable;
    @Column(name = "request_id", nullable = false, updatable = false)
    private UUID requestId;
    @Column(nullable = false, updatable = false)
    private Long amount;
    @Column(name = "collected_on", nullable = false, updatable = false)
    private LocalDate collectedOn;
    @Column(name = "remaining_amount", nullable = false, updatable = false)
    private Long remainingAmount;
    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;
    @Column(name = "trace_id", nullable = false, updatable = false)
    private String traceId;
    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;
}
