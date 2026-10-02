package com.erpapproid.core.common.api;

import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;

public final class MasterListQuery {
    private MasterListQuery() {}

    public static Pageable pageable(int page, int size, String sort, Set<String> allowed, String tieBreaker) {
        if (page < 0 || page > 10_000 || size < 1 || size > 100) {
            throw invalid("page는 0~10000, size는 1~100이어야 합니다.");
        }
        String[] parts = sort.split(",", -1);
        if (parts.length != 2 || !allowed.contains(parts[0])) throw invalid("지원하지 않는 정렬입니다.");
        Sort ordered;
        try { ordered = Sort.by(Sort.Direction.fromString(parts[1]), parts[0]); }
        catch (IllegalArgumentException ex) { throw invalid("지원하지 않는 정렬 방향입니다."); }
        if (!parts[0].equals(tieBreaker)) ordered = ordered.and(Sort.by(tieBreaker));
        return PageRequest.of(page, size, ordered);
    }

    public static String keyword(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.length() > 128) throw invalid("검색어는 128자 이하여야 합니다.");
        return "%" + value.trim().toLowerCase(java.util.Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    public static void positiveId(Long id) {
        if (id != null && id <= 0) throw invalid("품목 ID는 양수여야 합니다.");
    }

    public static DomainException invalid(String message) {
        return new DomainException(ErrorCode.INVALID_INPUT, message);
    }
}
