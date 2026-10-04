package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;
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
        @NotNull @Positive
        private Long lotId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        @NotNull
        private LocalDate deliveryDate;
        @Size(max = 64) private String vehicle;
        @Size(max = 64) private String trackingNo;
    }

    @Getter @Builder @Schema(name = "ShipmentUpdateRequest")
    public static final class UpdateRequest {
        @Positive private Long lotId;
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        private LocalDate deliveryDate;
        @Size(max = 64) private String vehicle;
        @Size(max = 64) private String trackingNo;
        public boolean hasChanges() { return lotId != null || qty != null || deliveryDate != null || vehicle != null || trackingNo != null; }
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
        private String itemName;
        private Long lotId;
        private String lotNo;
        private String inventoryTxnNo;
        private String receivableNo;
        private String trackingNo;
        private LocalDate departedDate;
        private LocalDate confirmedDate;
    }

    @Getter
    @Builder
    @Schema(name = "ShipmentConfirmResult")
    public static final class ConfirmResult {
        private Response shipment;
        private String receivableNo;
        private String inventoryTxnNo;
    }
}
