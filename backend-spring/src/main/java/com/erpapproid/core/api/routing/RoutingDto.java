package com.erpapproid.core.api.routing;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
        private String routingNo;
        @NotNull
        @Positive
        private Long itemId;
        @NotNull
        @Positive
        private Integer seq;
        @NotBlank
        private String process;
        @NotBlank
        private String workCenter;
        private BigDecimal stdTime;
        private Boolean isSubcontract;
    }

    @Getter
    @Builder
    @Schema(name = "RoutingResponse")
    public static final class Response {
        private Long id;
        private String routingNo;
        private Long itemId;
        private String itemNo;
        private Integer seq;
        private String process;
        private String workCenter;
        private BigDecimal stdTime;
        private Boolean isSubcontract;
    }
}
