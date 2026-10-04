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
@RequestMapping("/api/core/analytics/production")
@Tag(name = "production-analysis", description = "실제 작업오더 수량 기준 생산 진척 읽기")
public class ProductionProgressController {
    private final ProductionProgressService service;
    @GetMapping("/progress")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "생산 진척·지연·실적 요약", description = "완료예정일 기준 최대366일. 기본 서울 오늘±30일/활성 오더. 과거 시점 진척이나 설비 가동률을 추정하지 않음.")
    public ProductionProgressDto.Response read(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long itemId, @RequestParam(defaultValue = "active") String status,
            @RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "dueDate,asc") String sort,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.read(from, to, itemId, status, keyword, sort, page, size);
    }
}
