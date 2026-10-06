package com.erpapproid.core.api.production;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Getter;

public class ProductionPlanDto {

    private ProductionPlanDto() {
    }

    @Getter
    @Builder
    @Schema(name = "ProductionPlanRequest")
    public static final class Request {
        @NotBlank
        private String planNo;
        @NotNull
        @Positive
        private Long itemId;
        @NotBlank
        private String planMonth;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        private BigDecimal planQty;
        private BigDecimal orderQty;
        private BigDecimal stockQty;
        private BigDecimal gapQty;
        @jakarta.validation.constraints.Size(max = 1000)
        @Schema(description = "수량 산출 근거 메모. 감사 기록에만 남고 계획 수치에는 영향을 주지 않습니다.")
        private String basisNote;
    }

    @Getter
    @Builder
    @Schema(name = "ProductionPlanResponse")
    public static final class Response {
        private Long id;
        private String planNo;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private String planMonth;
        private BigDecimal planQty;
        private BigDecimal orderQty;
        private BigDecimal stockQty;
        private BigDecimal gapQty;
        private String status;
    }

    @Getter
    @Builder
    @Schema(name = "ProductionPlanSuggestionOrder")
    public static final class SuggestedOrder {
        private Long orderId;
        private String salesOrderNo;
        private java.time.LocalDate dueDate;
        private BigDecimal orderQty;
        private BigDecimal shippedQty;
        private BigDecimal remainingQty;
    }

    @Getter
    @Builder
    @Schema(name = "ProductionPlanSuggestion")
    public static final class Suggestion {
        private Long itemId;
        private String itemNo;
        private String itemName;
        private String planMonth;
        private java.time.LocalDate dueCutoff;
        private BigDecimal orderBacklogQty;
        private BigDecimal currentStock;
        private BigDecimal safetyStock;
        private BigDecimal suggestedPlanQty;
        private BigDecimal suggestedGapQty;
        private int openOrderCount;
        private java.util.List<SuggestedOrder> orders;
        private java.util.List<String> notes;
    }
}
