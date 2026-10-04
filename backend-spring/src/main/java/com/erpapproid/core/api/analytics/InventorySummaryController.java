package com.erpapproid.core.api.analytics;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/core/analytics/inventory")
@Tag(name = "inventory-analysis", description = "현재고·수불·Lot 근거의 읽기 전용 재고 분석")
public class InventorySummaryController {
    private final InventorySummaryService service;
    @GetMapping("/summary")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "현재 재고 정합성·Lot 경과·기간 증감", description = "기간은 수불 증감에만 적용. 현재고/과거 잔액/회전율을 추정하거나 자동 보정하지 않음.")
    public InventorySummaryDto.Response read(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "90") int ageDays, @RequestParam(required = false) Long itemId,
            @RequestParam(defaultValue = "all") String itemType, @RequestParam(defaultValue = "all") String risk,
            @RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "itemNo,asc") String sort,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.read(from, to, ageDays, itemId, itemType, risk, keyword, sort, page, size);
    }
}
