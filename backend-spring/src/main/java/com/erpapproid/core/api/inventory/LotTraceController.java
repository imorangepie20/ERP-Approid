package com.erpapproid.core.api.inventory;

import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "lot-traces", description = "읽기 전용 Lot 원천 추적; 기존 lots 배열/쓰기 API 유지")
@RestController
@RequestMapping("/api/core/lot-traces")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class LotTraceController {
    private final LotTraceService service;
    @GetMapping
    @Operation(summary = "Lot 원천 목록 검색·페이지")
    public Page<LotTraceDto.Row> list(@RequestParam(required = false) Long itemId,
            @RequestParam(defaultValue = "") String status, @RequestParam(defaultValue = "") String warehouse,
            @RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "lotNo,asc") String sort,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(itemId,status,warehouse,keyword,sort,page,size);
    }
    @GetMapping("/{id}")
    @Operation(summary = "Lot 및 연결 수불·입고·작업오더·출하 원천 (수불 페이지)")
    public LotTraceDto.Detail detail(@PathVariable long id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) { return service.detail(id,page,size); }
}
