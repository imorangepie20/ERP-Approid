package com.erpapproid.core.api.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Getter;

public class PurchaseOrderDto {

    private PurchaseOrderDto() {
    }

    @Getter
    @Builder
    @Schema(name = "PurchaseOrderRequest")
    public static final class Request {
        @NotBlank
        @Size(max = 32)
        private String purchaseOrderNo;
        @NotNull
        @Positive
        private Long vendorId;
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
    }

    @Getter
    @Builder
    @Schema(name = "PurchaseOrderResponse")
    public static final class Response {
        private Long id;
        private String purchaseOrderNo;
        private Long vendorId;
        private String vendorName;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private BigDecimal qty;
        private Long unitPrice;
        private Long amount;
        private LocalDate dueDate;
        private String status;
        private BigDecimal receivedQty;
    }
}
