package com.erpapproid.core.api.messaging;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.erpapproid.core.domain.messaging.DeliveryOutcome;
import com.erpapproid.core.domain.messaging.MessageState;
import com.erpapproid.core.domain.messaging.OutboundMessageEntity;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class MessageDto {
    private MessageDto() {}
    @Schema(name="ReminderRequest")
    public record Request(@NotNull UUID requestId, @NotNull @Positive Long contactId,
            @NotNull @Pattern(regexp="[a-f0-9]{64}") String expectedSnapshotHash,
            @NotNull @Size(max=1000) String note, @NotNull @AssertTrue Boolean acknowledged) {}
    @Schema(name="MessageAttemptResponse")
    public record Attempt(Integer attemptNumber, Instant startedAt, Instant finishedAt, DeliveryOutcome outcome, String errorCode) {}
    @Schema(name="MessageResponse")
    public record Response(UUID id, Long receivableId, MessageState state, String recipient, String subject, String body,
            Long remainingAmount, Instant requestedAt, Instant expiresAt, Instant nextAttemptAt, Integer attemptCount,
            Instant acceptedAt, String errorCode, List<Attempt> attempts) {}
    @Schema(name="MessageSummary")
    public record Summary(UUID id, Long receivableId, MessageState state, String recipient, String subject,
            Long remainingAmount, Instant requestedAt, Integer attemptCount, Instant acceptedAt, String errorCode) {}
    @Schema(name="MessageRequestResult")
    public record Result(Response message, boolean replayed) {}
    public static Summary summary(OutboundMessageEntity m) {
        return new Summary(m.getId(),m.getReceivable().getId(),m.getState(),m.getRecipient(),m.getSubject(),
                m.getRemainingAmount(),m.getRequestedAt(),m.getAttemptCount(),m.getAcceptedAt(),m.getErrorCode());
    }
}
