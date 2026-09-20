package com.erpapproid.core.api.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

public class LotDto {

    private LotDto() {
    }

    @Getter
    @Builder
    @Schema(name = "LotResponse")
    public static final class Response {
        private Long id;
        private String lotNo;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private String warehouse;
        private BigDecimal qty;
        private LocalDate producedAt;
        private LocalDate expiry;
        private String status;
        private boolean expiringSoon;
    }
}
