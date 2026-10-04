package com.erpapproid.core.api.analytics;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/core/analytics/mrp")
@Tag(name = "mrp", description = "BOM 전개·수량 보전 기반 Spring 계획 조회")
public class MrpController {
    private final MrpService service;
    @GetMapping("/suggestions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "MRP 제안 및 품목별 재고/발주/예정생산 충당량", description = "기본 계획 종료일은 서울 오늘+90일. 과거 미불출 소비·통계 예측·MOQ/EOQ·재고 예약은 포함하지 않음. 품목 필터는 전체 수량 차감 후 표시만 제한.")
    public MrpDto.Response read(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate through,
            @RequestParam(required = false) Long itemId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return service.read(through, itemId, page, size);
    }
}
