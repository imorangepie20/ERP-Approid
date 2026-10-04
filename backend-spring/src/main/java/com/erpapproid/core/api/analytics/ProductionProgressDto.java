package com.erpapproid.core.api.analytics;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

public final class ProductionProgressDto {
    private ProductionProgressDto() {}
    @Schema(name = "ProductionProgressSummary")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Summary(long totalOrders, long activeOrders, long completedOrders, long cancelledOrders,
            long delayedOrders, long unassignedActiveOrders, long overActualOrders,
            long eligibleActiveOrders, @Schema(nullable = true) BigDecimal meanActiveProgressPercent,
            long eligibleYieldOrders, @Schema(nullable = true) BigDecimal meanReportedYieldPercent) {}
    @Schema(name = "ProductionProgressRow")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Row(long id, String workOrderNo, long itemId, String itemNo, String itemName, String unit,
            BigDecimal qty, BigDecimal goodQty, BigDecimal defectQty, BigDecimal remainingQty,
            @Schema(nullable = true) BigDecimal progressPercent, @Schema(nullable = true) BigDecimal yieldPercent,
            LocalDate startDate, LocalDate dueDate, String status, String assignee, int priority,
            boolean delayed, boolean overActual) {}
    @Schema(name = "ProductionProgressResponse")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Response(Instant asOf, String timeZone, LocalDate from, LocalDate to, Long itemId,
            String status, String keyword, String sort, int page, int size, long totalElements, long totalPages,
            Summary summary, List<Row> rows, List<String> notes) {}
}
