package com.erpapproid.core.domain.production;

import java.math.BigDecimal;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "WorkOrderRoutingStep", description = "작업오더 생성 시점의 공정 정보")
public record RoutingStepSnapshot(Long routingId, String routingNo, Integer seq, String process,
                                  String workCenter, BigDecimal stdTime, Boolean isSubcontract) {}
