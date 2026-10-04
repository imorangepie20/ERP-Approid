package com.erpapproid.core.api.analytics;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import com.erpapproid.core.domain.analytics.MrpCalculator.Row;
import io.swagger.v3.oas.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonInclude;

public final class MrpDto {
    private MrpDto() {}
    @Schema(name = "MrpResponse")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Response(Instant asOf, String timeZone, LocalDate through, Long itemId, int page, int size,
                           long totalElements, int totalPages, int activeWorkOrders, long purchaseNeededItems,
                           long productionNeededItems, long missingBomItems, List<Row> rows, List<String> notes) {}
}
