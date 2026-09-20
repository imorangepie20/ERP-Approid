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
}
