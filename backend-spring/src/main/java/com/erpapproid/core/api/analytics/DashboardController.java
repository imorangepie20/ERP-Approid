package com.erpapproid.core.api.analytics;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/core/analytics/dashboard")
@Tag(name = "dashboard", description = "Spring 읽기 전용 운영 집계")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class DashboardController {
    private final DashboardService service;

    @GetMapping
    @Operation(summary = "동일 DB 스냅샷의 KPI·월별 추이·현재 위험 알림", description = "기간 기본값은 서울 기준 이번 달. 최대 366일. 잔고/알림은 조회 시점 현재값이며 재고회전율은 원가 이력 부족으로 null.")
    public DashboardDto.Response dashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long itemId) {
        return service.read(from, to, itemId);
    }
}
