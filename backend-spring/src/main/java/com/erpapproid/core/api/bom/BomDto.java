package com.erpapproid.core.api.bom;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Getter;

public class BomDto {

    private BomDto() {
    }

    @Getter
    @Builder
    @Schema(name = "BomRequest")
    public static final class Request {
        @NotBlank
        @Size(max = 32)
        private String bomNo;
        @NotNull
        @Positive
        private Long parentId;
        @NotNull
        @Positive
        private Long childId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        @DecimalMin("0")
        @DecimalMax("100")
        @Digits(integer = 3, fraction = 2)
        private BigDecimal lossRate;
        @Size(max = 32)
        private String substituteNo;
    }

    @Getter
    @Builder
    @Schema(name = "BomUpdateRequest")
    public static final class UpdateRequest {
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        @DecimalMin("0")
        @DecimalMax("100")
        @Digits(integer = 3, fraction = 2)
        private BigDecimal lossRate;
        @Size(max = 32)
        private String substituteNo;

        public boolean hasChanges() { return qty != null || lossRate != null || substituteNo != null; }
    }

    @Getter
    @Builder
    @Schema(name = "BomResponse")
    public static final class Response {
        private Long id;
        private String bomNo;
        private Long parentId;
        private String parentItemNo;
        private String parentName;
        private Long childId;
        private String childItemNo;
        private String childName;
        private String childType;
        private String childUnit;
        private BigDecimal qty;
        private BigDecimal lossRate;
        private String substituteNo;
    }
}
