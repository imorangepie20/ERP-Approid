package com.erpapproid.core.api.sales;

import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

public class ReceivableDto {

    private ReceivableDto() {
    }

    @Getter
    @Builder
    @Schema(name = "ReceivableResponse")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static final class Response {
        private Long id;
        private String receivableNo;
        private Long customerId;
        private String customerName;
        private Long salesOrderId;
        private String salesOrderNo;
        private Long amount;
        private Long collectedAmount;
        private Long openingCollectedAmount;
        private Long remainingAmount;
        private LocalDate dueDate;
        private Integer overdueDays;
        private String status;
        private boolean overdue;
        private LocalDate referenceDate;
    }

    @Getter
    @Builder
    @Schema(name = "ReceivableSummary")
    public static final class Summary {
        private long openCount;
        private Long openAmount;
        private long overdueCount;
        private Long overdueAmount;
        private Long openBalance;
        private Long overdueBalance;
        private LocalDate referenceDate;
    }

    @Schema(name = "ReceivableCollectionRequest")
    public record CollectionRequest(
            @NotNull @Positive @JsonDeserialize(using = IntegerMoneyDeserializer.class) Long amount,
            @NotNull LocalDate collectedOn, @NotNull UUID requestId) {}

    @Schema(name = "ReceivableCollectionResponse")
    public record CollectionResponse(Long id, UUID requestId, Long amount, LocalDate collectedOn,
            Long remainingAmount, Long actorId, String traceId, Instant recordedAt) {}

    @Schema(name = "ReceivableCollectionResult")
    public record CollectionResult(Response receivable, CollectionResponse collection, boolean replayed) {}

    @Schema(name = "ReceivableDetail")
    public record Detail(Response receivable, Page<CollectionResponse> collections) {}

    @Schema(name = "ReceivableReminderPreview")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record ReminderPreview(Response receivable, String contactName, String contact,
            com.erpapproid.core.api.messaging.MessageContactDto.Response messageContact, String snapshotHash,
            boolean emailDispatchEnabled, String emailSubject, String emailBody) {}

    public static final class IntegerMoneyDeserializer extends JsonDeserializer<Long> {
        @Override
        public Long deserialize(JsonParser parser, DeserializationContext context) throws java.io.IOException {
            if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
                return context.reportInputMismatch(Long.class, "수납 금액은 정수 KRW여야 합니다.");
            }
            return parser.getLongValue();
        }
    }
}
