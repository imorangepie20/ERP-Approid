package com.erpapproid.core.api.item;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Builder;
import lombok.Getter;

public class ItemDto {

    private ItemDto() {
    }

    @Getter
    @Builder
    @Schema(name = "ItemRequest")
    public static final class Request {
        @NotBlank
        @Schema(description = "품번", example = "M-S001")
        private String itemNo;
        @NotBlank
        private String name;
        private String spec;
        private String category;
        @NotBlank
        @Schema(description = "제품 / 반제품 / 자재", example = "자재")
        private String itemType;
        @NotBlank
        private String unit;
        @NotNull
        @PositiveOrZero
        private Long price;
        @PositiveOrZero
        private BigDecimal safetyStock;
        @PositiveOrZero
        private Integer leadTimeDays;
    }

    @Getter
    @Builder
    @Schema(name = "ItemResponse")
    public static final class Response {
        private Long id;
        private String itemNo;
        private String name;
        private String spec;
        private String category;
        private String itemType;
        private String unit;
        private Long price;
        private BigDecimal stock;
        private BigDecimal safetyStock;
        private Integer leadTimeDays;
    }
}
