package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Getter;

public class SalesOrderDto {

    private SalesOrderDto() {
    }

    @Getter
    @Builder
    @Schema(name = "SalesOrderRequest")
    public static final class Request {
        @NotBlank
        private String salesOrderNo;
        @Positive
        private Long quotationId;
        @NotNull
        @Positive
        private Long customerId;
        @NotNull
        @Positive
        private Long itemId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        private BigDecimal qty;
        @NotNull
        @Positive
        private Long unitPrice;
        @NotNull
        private LocalDate dueDate;
        private LocalDate orderedAt;
    }

    @Getter
    @Builder
    @Schema(name = "SalesOrderResponse")
    public static final class Response {
        private Long id;
        private String salesOrderNo;
        private Long quotationId;
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
        private LocalDate orderedAt;
        private String status;
    }

    @Getter
    @Builder
    @Schema(name = "SalesOrderConfirmResult")
    public static final class ConfirmResult {
        private Response salesOrder;
        private String workOrderNo;
    }
}
