package com.erpapproid.core.api.production;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import com.erpapproid.core.domain.production.RoutingStepSnapshot;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
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
        @Size(max = 32)
        private String workOrderNo;
        @Positive
        private Long salesOrderId;
        @NotNull
        @Positive
        private Long itemId;
        @NotNull
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        private LocalDate startDate;
        @NotNull
        private LocalDate dueDate;
        @Size(max = 64)
        private String assignee;
        @Min(1)
        @Max(3)
        private Integer priority;
    }

    @Getter
    @Builder
    @Schema(name = "WorkOrderUpdateRequest")
    public static final class UpdateRequest {
        @DecimalMin(value = "0", inclusive = false)
        @Digits(integer = 14, fraction = 4)
        private BigDecimal qty;
        private LocalDate startDate;
        private LocalDate dueDate;
        @Size(max = 64)
        private String assignee;
        @Min(1)
        @Max(3)
        private Integer priority;

        public boolean hasChanges() {
            return qty != null || startDate != null || dueDate != null || assignee != null || priority != null;
        }
    }

    @Getter
    @Builder
    @Schema(name = "WorkOrderCompleteRequest")
    public static class CompleteRequest {
        @DecimalMin(value = "0")
        @Digits(integer = 14, fraction = 4)
        private BigDecimal goodQty;
        @DecimalMin(value = "0")
        @Digits(integer = 14, fraction = 4)
        private BigDecimal defectQty;
        public boolean hasChanges() { return goodQty != null || defectQty != null; }
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
        private List<RoutingStepSnapshot> routingSteps;
        @Schema(description = "전체 공정의 표준시간 합계 × 작업오더 수량(h)")
        private BigDecimal plannedTimeHours;
        @Schema(description = "외주 공정의 표준시간 합계 × 작업오더 수량(h)")
        private BigDecimal subcontractTimeHours;
        private String assignee;
        @Schema(description = "우선순위: 1 일반, 2 높음, 3 긴급")
        private Integer priority;
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
