package com.erpapproid.core.api.partner;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Getter;

public class PartnerDto {

    private PartnerDto() {
    }

    @Getter
    @Builder
    @Schema(name = "PartnerCreateRequest")
    public static final class CreateRequest {
        @NotBlank
        @Size(max = 32)
        private String partnerNo;
        @NotBlank
        @Size(max = 128)
        private String name;
        @Size(max = 64)
        private String contact;
        @Size(max = 64)
        private String contactName;
        @NotNull
        @PositiveOrZero
        private Integer paymentTerms;
        @PositiveOrZero
        private Integer leadTimeDays;
        @NotBlank
        @Pattern(regexp = "고객사|발주처|외주처")
        private String partnerType;
    }

    @Getter
    @Builder
    @Schema(name = "PartnerUpdateRequest")
    public static final class UpdateRequest {
        @Size(max = 128)
        @Pattern(regexp = ".*\\S.*", flags = Pattern.Flag.DOTALL)
        private String name;
        @Size(max = 64)
        private String contact;
        @Size(max = 64)
        private String contactName;
        @PositiveOrZero
        private Integer paymentTerms;
        @PositiveOrZero
        private Integer leadTimeDays;
        @Pattern(regexp = "고객사|발주처|외주처")
        private String partnerType;

        public boolean hasChanges() {
            return name != null || contact != null || contactName != null
                    || paymentTerms != null || leadTimeDays != null || partnerType != null;
        }
    }

    @Getter
    @Builder
    @Schema(name = "PartnerResponse")
    public static final class Response {
        private Long id;
        private String partnerNo;
        private String name;
        private String contact;
        private String contactName;
        private Integer leadTimeDays;
        private Integer paymentTerms;
        private String partnerType;
    }
}
