package com.erpapproid.core.api.analytics;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

public final class SalesSummaryDto {
    private SalesSummaryDto() {}
    @Schema(name = "SalesAnalysisSummary")
    public record Summary(long periodOrders, long periodCancelledOrders, BigDecimal periodOrderKrw,
            long periodConfirmedShipments, BigDecimal periodRevenueKrw,
            long currentBacklogOrders, long unknownBacklogOrders, BigDecimal knownCurrentBacklogKrw,
            long currentOpenReceivables, BigDecimal currentOpenReceivableKrw,
            long currentOverdueReceivables, BigDecimal currentOverdueReceivableKrw,
            long excludedHistoricalShipments, long excludedUnlinkedReceivables) {}
    @Schema(name = "SalesAnalysisRow")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Row(long id, String salesOrderNo, long customerId, String customerNo, String customerName,
            long itemId, String itemNo, String itemName, String unit, BigDecimal qty, BigDecimal amountKrw,
            LocalDate orderedAt, LocalDate dueDate, String status, BigDecimal knownShippedQty,
            BigDecimal knownShippedAmountKrw, BigDecimal periodRevenueKrw,
            @Schema(nullable = true) BigDecimal currentBacklogKrw,
            BigDecimal currentOpenReceivableKrw, BigDecimal currentOverdueReceivableKrw,
            boolean historyUnknown, boolean delayed) {}
    @Schema(name = "SalesAnalysisResponse")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Response(Instant asOf, String timeZone, LocalDate from, LocalDate to, Long itemId, Long customerId,
            String keyword, String scope, String sort, int page, int size, long totalElements, long totalPages,
            Summary summary, List<Row> rows, List<String> notes) {}
}
