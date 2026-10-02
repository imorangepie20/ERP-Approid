package com.erpapproid.core.api.routing;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;
import lombok.Getter;

public class RoutingDto {

    private RoutingDto() {
    }

    @Getter
    @Builder
    @Schema(name = "RoutingRequest")
    public static final class Request {
        @NotBlank
        @Size(max = 32)
        private String routingNo;
        @NotNull
        @Positive
        private Long itemId;
        @NotNull
        @Positive
        private Integer seq;
        @NotBlank
        @Size(max = 64)
        private String process;
        @NotBlank
        @Size(max = 32)
        private String workCenter;
        @DecimalMin("0")
        @Digits(integer = 7, fraction = 3)
        @Schema(description = "품목 1단위당 표준시간(h)")
        private BigDecimal stdTime;
        private Boolean isSubcontract;
    }

    @Getter
    @Builder
    @Schema(name = "RoutingUpdateRequest")
    public static final class UpdateRequest {
        @Positive
        private Integer seq;
        @Size(max = 64)
        @Pattern(regexp = ".*\\S.*", flags = Pattern.Flag.DOTALL)
        private String process;
        @Size(max = 32)
        @Pattern(regexp = ".*\\S.*", flags = Pattern.Flag.DOTALL)
        private String workCenter;
        @DecimalMin("0")
        @Digits(integer = 7, fraction = 3)
        private BigDecimal stdTime;
        private Boolean isSubcontract;
        public boolean hasChanges() {
            return seq != null || process != null || workCenter != null || stdTime != null || isSubcontract != null;
        }
    }

    @Getter
    @Builder
    @Schema(name = "RoutingResponse")
    public static final class Response {
        private Long id;
        private String routingNo;
        private Long itemId;
        private String itemNo;
        private String itemName;
        private Integer seq;
        private String process;
        private String workCenter;
        private BigDecimal stdTime;
        private Boolean isSubcontract;
    }
}
