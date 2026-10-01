package com.erpapproid.core.api.item;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Getter;

public class ItemDto {

    private ItemDto() {
    }

    @Getter
    @Builder
    @Schema(name = "ItemCreateRequest")
    public static final class CreateRequest {
        @NotBlank
        @Size(max = 32)
        @Schema(description = "품번", example = "M-S001")
        private String itemNo;
        @NotBlank
        @Size(max = 128)
        private String name;
        @Size(max = 128)
        private String spec;
        @Size(max = 64)
        private String category;
        @NotBlank
        @Size(max = 16)
        @Pattern(regexp = "제품|반제품|자재")
        @Schema(description = "제품 / 반제품 / 자재", example = "자재")
        private String itemType;
        @NotBlank
        @Size(max = 16)
        private String unit;
        @NotNull
        @PositiveOrZero
        private Long price;
        @PositiveOrZero
        @Digits(integer = 14, fraction = 4)
        private BigDecimal safetyStock;
        @PositiveOrZero
        private Integer leadTimeDays;
    }

    @Getter
    @Builder
    @Schema(name = "ItemUpdateRequest")
    public static final class UpdateRequest {
        @Size(max = 128)
        @Pattern(regexp = ".*\\S.*")
        private String name;
        @Size(max = 128)
        private String spec;
        @Size(max = 64)
        private String category;
        @Size(max = 16)
        @Pattern(regexp = "제품|반제품|자재")
        @Schema(description = "제품 / 반제품 / 자재", example = "자재")
        private String itemType;
        @Size(max = 16)
        @Pattern(regexp = ".*\\S.*")
        private String unit;
        @PositiveOrZero
        private Long price;
        @PositiveOrZero
        @Digits(integer = 14, fraction = 4)
        private BigDecimal safetyStock;
        @PositiveOrZero
        private Integer leadTimeDays;

        public boolean hasChanges() {
            return name != null || spec != null || category != null || itemType != null
                    || unit != null || price != null || safetyStock != null || leadTimeDays != null;
        }
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
