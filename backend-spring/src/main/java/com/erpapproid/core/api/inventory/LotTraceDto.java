package com.erpapproid.core.api.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Page;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

public final class LotTraceDto {
    private LotTraceDto() {}
    @Schema(name = "LotTraceRow")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Row(long id, String lotNo, long itemId, String itemNo, String itemName, String unit,
            String warehouse, BigDecimal qty, LocalDate producedAt, LocalDate expiry, String status,
            boolean expired, boolean expiringSoon, boolean invalid, LocalDate referenceDate) {}

    @Schema(name = "LotTraceMovement")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Movement(long id, long itemId, String unit, String txnNo, String txnType, BigDecimal qty, LocalDate txnDate,
            String warehouse, String refType, String refNo, String sourceType, Long sourceId, String sourceNo) {}

    @Schema(name = "LotTraceDetail")
    public record Detail(Instant asOf, String timeZone, Row lot, Page<Movement> movements, List<String> notes) {}
}
