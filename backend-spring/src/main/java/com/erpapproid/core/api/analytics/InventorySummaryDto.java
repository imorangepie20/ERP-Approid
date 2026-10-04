package com.erpapproid.core.api.analytics;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

public final class InventorySummaryDto {
    private InventorySummaryDto() {}
    @Schema(name = "InventoryAnalysisSummary")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Summary(long totalItems, long lowStockItems, long ledgerMismatchItems, long lotMismatchItems,
            long agedItems, long heldItems, long expiredItems, long invalidLots, long futureTransactions,
            @Schema(nullable = true) BigDecimal inventoryTurnover) {}
    @Schema(name = "InventoryAnalysisRow")
    public record Row(long itemId, String itemNo, String itemName, String itemType, String unit,
            BigDecimal currentStock, BigDecimal safetyStock, BigDecimal ledgerBalance, BigDecimal stockLedgerDelta,
            BigDecimal recordedLotQty, BigDecimal knownUsableLotQty, BigDecimal heldLotQty, BigDecimal expiredLotQty,
            BigDecimal agedLotQty, BigDecimal periodIncreaseQty, BigDecimal periodDecreaseQty, BigDecimal periodNetQty,
            long lotCount, long invalidLots, long futureTransactions, boolean lowStock,
            boolean ledgerMismatch, boolean lotMismatch) {}
    @Schema(name = "InventoryAnalysisResponse")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Response(Instant asOf, String timeZone, LocalDate from, LocalDate to, int ageDays, Long itemId,
            String itemType, String risk, String keyword, String sort, int page, int size,
            long totalElements, long totalPages, Summary summary, List<Row> rows, List<String> notes) {}
}
