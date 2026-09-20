package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Getter;

public class ShipmentDto {

    private ShipmentDto() {
    }

    @Getter
    @Builder
    @Schema(name = "ShipmentRequest")
    public static final class Request {
        @NotNull
        @Positive
        private Long salesOrderId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        private BigDecimal qty;
        @NotNull
        private LocalDate deliveryDate;
        private String vehicle;
    }

    @Getter
    @Builder
    @Schema(name = "ShipmentResponse")
    public static final class Response {
        private Long id;
        private String shipmentNo;
        private Long salesOrderId;
        private String salesOrderNo;
        private Long customerId;
        private String customerName;
        private Long itemId;
        private String itemNo;
        private BigDecimal qty;
        private Long amount;
        private LocalDate deliveryDate;
        private String vehicle;
        private String status;
    }

    @Getter
    @Builder
    @Schema(name = "ShipmentConfirmResult")
    public static final class ConfirmResult {
        private Response shipment;
        private String receivableNo;
    }
}
