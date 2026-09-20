package com.erpapproid.core.api.partner;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Builder;
import lombok.Getter;

public class PartnerDto {

    private PartnerDto() {
    }

    @Getter
    @Builder
    @Schema(name = "PartnerRequest")
    public static final class Request {
        @NotBlank
        private String partnerNo;
        @NotBlank
        private String name;
        private String contact;
        @NotNull
        @PositiveOrZero
        private Integer paymentTerms;
        @NotBlank
        private String partnerType;
    }

    @Getter
    @Builder
    @Schema(name = "PartnerResponse")
    public static final class Response {
        private Long id;
        private String partnerNo;
        private String name;
        private String contact;
        private Integer paymentTerms;
        private String partnerType;
    }
}
