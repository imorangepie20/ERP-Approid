package com.erpapproid.core.api.sales;

import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

public class ReceivableDto {

    private ReceivableDto() {
    }

    @Getter
    @Builder
    @Schema(name = "ReceivableResponse")
    public static final class Response {
        private Long id;
        private String receivableNo;
        private Long customerId;
        private String customerName;
        private Long salesOrderId;
        private String salesOrderNo;
        private Long amount;
        private LocalDate dueDate;
        private Integer overdueDays;
        private String status;
        private boolean overdue;
    }

    @Getter
    @Builder
    @Schema(name = "ReceivableSummary")
    public static final class Summary {
        private long openCount;
        private Long openAmount;
        private long overdueCount;
        private Long overdueAmount;
    }
}
