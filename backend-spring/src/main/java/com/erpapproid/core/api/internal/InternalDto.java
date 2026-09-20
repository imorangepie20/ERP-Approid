package com.erpapproid.core.api.internal;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

public class InternalDto {

    private InternalDto() {
    }

    @Getter
    @Builder
    @Schema(name = "InternalItemRow")
    public static final class ItemRow {
        private Long id;
        private String itemNo;
        private String name;
        private String itemType;
        private String unit;
        private Long price;
        private BigDecimal safetyStock;
        private Integer leadTimeDays;
    }

    @Getter
    @Builder
    @Schema(name = "InternalStockRow")
    public static final class StockRow {
        private Long itemId;
        private String itemNo;
        private BigDecimal onHand;
        private BigDecimal safetyStock;
    }

    @Getter
    @Builder
    @Schema(name = "InternalWorkOrderRow")
    public static final class WorkOrderRow {
        private Long id;
        private String workOrderNo;
        private Long itemId;
        private String itemNo;
        private BigDecimal qty;
        private BigDecimal goodQty;
        private LocalDate dueDate;
        private String status;
    }

    @Getter
    @Builder
    @Schema(name = "InternalBomRow")
    public static final class BomRow {
        private Long id;
        private Long parentId;
        private String parentItemNo;
        private Long childId;
        private String childItemNo;
        private BigDecimal qty;
        private BigDecimal lossRate;
    }
}
