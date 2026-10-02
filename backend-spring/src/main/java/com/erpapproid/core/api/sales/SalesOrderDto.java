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

public class SalesOrderDto {

    private SalesOrderDto() {
    }

    @Getter
    @Builder
    @Schema(name = "SalesOrderRequest")
    public static final class Request {
        @NotBlank
        @Size(max = 32)
        private String salesOrderNo;
        @Schema(description = "직접 등록에서는 사용 불가. 견적 전환 전용 endpoint를 사용하세요.")
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
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        @NotNull
        @Positive
        @Max(9007199254740991L)
        private Long unitPrice;
        @NotNull
        private LocalDate dueDate;
        private LocalDate orderedAt;
    }

    @Getter
    @Builder
    @Schema(name = "SalesOrderUpdateRequest")
    public static final class UpdateRequest {
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        @Positive
        @Max(9007199254740991L)
        private Long unitPrice;
        private LocalDate dueDate;

        public boolean hasChanges() { return qty != null || unitPrice != null || dueDate != null; }
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
        private Integer paymentTerms;
        private Integer leadTimeDays;
        private java.util.List<String> workOrderNos;
    }

    @Getter
    @Builder
    @Schema(name = "SalesOrderConfirmResult")
    public static final class ConfirmResult {
        private Response salesOrder;
        private String workOrderNo;
        private Long workOrderId;
    }
}
