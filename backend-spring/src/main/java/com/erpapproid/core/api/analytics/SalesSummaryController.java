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
@RequestMapping("/api/core/analytics/sales")
@Tag(name = "sales-analysis", description = "수주·확정 출하·현재 잔고/미수 읽기")
public class SalesSummaryController {
    private final SalesSummaryService service;
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','ACCOUNTING')")
    @Operation(summary = "영업 요약", description = "기간 실적과 현재 잔고/미수 구분. 원가·수납일·부분수납 이력 추정 없음.")
    public SalesSummaryDto.Response read(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long itemId, @RequestParam(required = false) Long customerId,
            @RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "ordered") String scope,
            @RequestParam(defaultValue = "orderedAt,desc") String sort, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.read(from, to, itemId, customerId, keyword, scope, sort, page, size);
    }
}
