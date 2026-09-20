package com.erpapproid.core.api.production;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Getter;

public class WorkOrderDto {

    private WorkOrderDto() {
    }

    @Getter
    @Builder
    @Schema(name = "WorkOrderRequest")
    public static final class Request {
        @NotBlank
        private String workOrderNo;
        @Positive
        private Long salesOrderId;
        @NotNull
        @Positive
        private Long itemId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        private BigDecimal qty;
        private LocalDate startDate;
        @NotNull
        private LocalDate dueDate;
    }

    @Getter
    @Builder
    @Schema(name = "WorkOrderCompleteRequest")
    public static class CompleteRequest {
        @DecimalMin(value = "0")
        private BigDecimal goodQty;
        @DecimalMin(value = "0")
        private BigDecimal defectQty;
    }

    @Getter
    @Builder
    @Schema(name = "WorkOrderResponse")
    public static final class Response {
        private Long id;
        private String workOrderNo;
        private Long salesOrderId;
        private String salesOrderNo;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private BigDecimal qty;
        private BigDecimal goodQty;
        private BigDecimal defectQty;
        private BigDecimal progress;
        private LocalDate startDate;
        private LocalDate dueDate;
        private String status;
        private boolean delayed;
    }

    @Getter
    @Builder
    @Schema(name = "WorkOrderCompleteResult")
    public static final class CompleteResult {
        private Response workOrder;
        private String lotNo;
        private String inventoryTxnNo;
    }
}
