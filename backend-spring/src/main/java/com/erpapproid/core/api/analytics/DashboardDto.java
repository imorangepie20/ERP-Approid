package com.erpapproid.core.api.analytics;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonInclude;

public final class DashboardDto {
    private DashboardDto() {}

    @Schema(name = "DashboardMetadata")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Metadata(Instant asOf, String timeZone, LocalDate from, LocalDate to, Long itemId,
                           String snapshotScope) {}

    @Schema(name = "DashboardKpis")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Kpis(BigDecimal revenueKrw, BigDecimal productionValueKrw, BigDecimal backlogKrw,
                       long backlogOrders, @Schema(nullable = true) BigDecimal onTimeDeliveryPercent,
                       long onTimeOrders, long eligibleDeliveryOrders,
                       @Schema(nullable = true) BigDecimal meanOrderDefectPercent, long completedWorkOrders,
                       @Schema(nullable = true) BigDecimal inventoryTurnover, String inventoryTurnoverReason) {}

    @Schema(name = "DashboardTrend")
    public record Trend(String month, BigDecimal revenueKrw, BigDecimal productionValueKrw) {}

    @Schema(name = "DashboardAlert")
    public record Alert(String kind, String referenceNo, String itemName, String message, String path) {}

    @Schema(name = "DashboardAlerts")
    public record Alerts(long lowStockItems, long overdueWorkOrders, long overdueSalesOrders,
                         long total, boolean truncated, List<Alert> rows) {}

    @Schema(name = "DashboardCoverage")
    public record Coverage(long undatedShipments, long undatedCompletedWorkOrders,
                           long unknownDeliveryOrders, List<String> notes) {}

    @Schema(name = "DashboardResponse")
    public record Response(Metadata metadata, Kpis kpis, List<Trend> trends, Alerts alerts, Coverage coverage) {}
}
