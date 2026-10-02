package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import lombok.Builder;
import lombok.Getter;

public class QuotationDto {

    private QuotationDto() {
    }

    @Getter
    @Builder
    @Schema(name = "QuotationRequest")
    public static final class Request {
        @NotBlank
        @Size(max = 32)
        private String quotationNo;
        @NotNull
        @Positive
        private Long customerId;
        @NotNull
        @Positive
        private Long itemId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        @NotNull
        @Positive
        @Max(9007199254740991L)
        private Long unitPrice;
        @NotNull
        private LocalDate dueDate;
        @NotNull
        private LocalDate validUntil;
    }

    @Getter
    @Builder
    @Schema(name = "QuotationUpdateRequest")
    public static final class UpdateRequest {
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        @Positive
        @Max(9007199254740991L)
        private Long unitPrice;
        private LocalDate dueDate;
        private LocalDate validUntil;

        public boolean hasChanges() {
            return qty != null || unitPrice != null || dueDate != null || validUntil != null;
        }
    }

    @Getter
    @Builder
    @Schema(name = "QuotationResponse")
    public static final class Response {
        private Long id;
        private String quotationNo;
        private Long customerId;
        private String customerName;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private BigDecimal qty;
        private Long unitPrice;
        private Long amount;
        private LocalDate dueDate;
        private LocalDate validUntil;
        private String status;
        private Integer paymentTerms;
        private Integer leadTimeDays;
    }
}
