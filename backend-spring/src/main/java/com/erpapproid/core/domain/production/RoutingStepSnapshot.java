package com.erpapproid.core.domain.production;

import java.math.BigDecimal;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "WorkOrderRoutingStep", description = "작업오더 생성 시점의 공정 정보와 공정별 실적")
public record RoutingStepSnapshot(Long routingId, String routingNo, Integer seq, String process,
                                   String workCenter, BigDecimal stdTime, Boolean isSubcontract,
                                   @Schema(description = "공정 상태: 대기/진행중/완료. 마스터 데이터가 아니며 실적 입력으로만 변경된다.")
                                   String opStatus,
                                   @Schema(description = "공정 착수일. 실적 입력으로만 기록된다.")
                                   java.time.LocalDate startedAt,
                                   @Schema(description = "공정 완료일. 실적 입력으로만 기록된다.")
                                   java.time.LocalDate completedAt,
                                   @Schema(description = "공정 양품 실적. 헤더 양품과 대사한다.")
                                   BigDecimal actualGoodQty,
                                   @Schema(description = "공정 불량 실적. 헤더 불량과 대사한다.")
                                   BigDecimal actualDefectQty) {
    public RoutingStepSnapshot(Long routingId, String routingNo, Integer seq, String process,
                               String workCenter, BigDecimal stdTime, Boolean isSubcontract) {
        this(routingId, routingNo, seq, process, workCenter, stdTime, isSubcontract,
                "대기", null, null, null, null);
    }
}
