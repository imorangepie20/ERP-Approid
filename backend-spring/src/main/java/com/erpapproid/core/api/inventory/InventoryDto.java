package com.erpapproid.core.api.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

public class InventoryDto {

    private InventoryDto() {
    }

    @Getter
    @Builder
    @Schema(name = "InventoryStockRow")
    public static final class StockRow {
        private Long itemId;
        private String itemNo;
        private String itemName;
        private String itemType;
        private String unit;
        private BigDecimal stock;
        private BigDecimal safetyStock;
        private boolean lowStock;
        private Integer leadTimeDays;
    }

    @Getter
    @Builder
    @Schema(name = "InventoryLowStockRow")
    public static final class LowStockRow {
        private Long itemId;
        private String itemNo;
        private String itemName;
        private String unit;
        private BigDecimal stock;
        private BigDecimal safetyStock;
        private BigDecimal shortfall;
    }

    @Getter
    @Builder
    @Schema(name = "InventoryTxnRow")
    public static final class TxnRow {
        private Long id;
        private String txnNo;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private String warehouse;
        private String txnType;
        private BigDecimal qty;
        private String refType;
        private String refNo;
        private LocalDate txnDate;
    }

    @Getter
    @Builder
    @Schema(name = "InventoryAdjustRequest")
    public static final class AdjustRequest {
        @jakarta.validation.constraints.NotNull
        @jakarta.validation.constraints.Positive
        private Long itemId;
        @jakarta.validation.constraints.NotNull
        @jakarta.validation.constraints.DecimalMin(value = "0")
        private BigDecimal countedQty;
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Size(max = 32)
        private String warehouse;
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Size(max = 200)
        private String reason;
    }

    @Getter
    @Builder
    @Schema(name = "InventoryAdjustResponse")
    public static final class AdjustResponse {
        private Long itemId;
        private String itemNo;
        private String itemName;
        private BigDecimal previousStock;
        private BigDecimal ledgerBalance;
        private BigDecimal countedQty;
        private BigDecimal adjustedQty;
        private String txnNo;
        private String txnType;
        private LocalDate txnDate;
    }
}
