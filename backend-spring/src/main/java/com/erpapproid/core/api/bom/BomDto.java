package com.erpapproid.core.api.bom;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
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
        private String bomNo;
        @NotNull
        @Positive
        private Long parentId;
        @NotNull
        @Positive
        private Long childId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        private BigDecimal qty;
        private BigDecimal lossRate;
        private String substituteNo;
    }

    @Getter
    @Builder
    @Schema(name = "BomResponse")
    public static final class Response {
        private Long id;
        private String bomNo;
        private Long parentId;
        private String parentItemNo;
        private Long childId;
        private String childItemNo;
        private BigDecimal qty;
        private BigDecimal lossRate;
        private String substituteNo;
    }
}
