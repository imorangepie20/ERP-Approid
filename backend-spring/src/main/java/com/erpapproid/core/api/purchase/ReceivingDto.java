package com.erpapproid.core.api.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Digits;
import lombok.Builder;
import lombok.Getter;

public class ReceivingDto {

    private ReceivingDto() {
    }

    @Getter
    @Builder
    @Schema(name = "ReceivingRequest")
    public static final class Request {
        @NotNull
        @Positive
        private Long purchaseOrderId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal receivedQty;
        @DecimalMin(value = "0")
        @Digits(integer = 14, fraction = 4)
        private BigDecimal defectQty;
        private LocalDate receivedDate;
    }

    @Getter
    @Builder
    @Schema(name = "ReceivingResponse")
    public static final class Response {
        private Long id;
        private String receivingNo;
        private Long purchaseOrderId;
        private String purchaseOrderNo;
        private Long vendorId;
        private String vendorName;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private BigDecimal orderQty;
        private BigDecimal receivedQty;
        private BigDecimal defectQty;
        private LocalDate receivedDate;
        private String status;
        private BigDecimal goodQty;
        private String lotNo;
        private String inventoryTxnNo;
        private String reversalTxnNo;
        private LocalDate cancelledDate;
        private boolean stockApplied;
    }

    @Getter
    @Builder
    @Schema(name = "ReceivingCreateResult")
    public static final class CreateResult {
        private Response receiving;
        private String lotNo;
        private String inventoryTxnNo;
    }
}
