package com.erpapproid.core.api.analytics;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.analytics.MrpCalculator;
import com.erpapproid.core.domain.analytics.MrpCalculator.*;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MrpService {
    private final NamedParameterJdbcTemplate jdbc;
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public MrpDto.Response read(LocalDate requestedThrough, Long itemId, int page, int size) {
        Instant asOf = Instant.now(); LocalDate today = asOf.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
        LocalDate through = requestedThrough == null ? today.plusDays(90) : requestedThrough;
        if (through.isBefore(today) || ChronoUnit.DAYS.between(today, through) > 365 || itemId != null && itemId <= 0
                || page < 0 || page > 100000 || size < 1 || size > 100) {
            throw new DomainException(ErrorCode.INVALID_INPUT, "계획 종료일은 오늘~365일 이후, 페이지는 0~100000, 크기는 1~100이어야 합니다.");
        }
        Map<String, Object> p = Map.of("through", through, "today", today);
        var items = jdbc.query("""
            select i.*, coalesce(h.qty,0) unavailable from items i
            left join (select item_id,sum(qty) qty from lots where status <> '정상' or expiry < :today group by item_id) h on h.item_id=i.id
            order by i.id limit 10001
            """, p, (rs, n) -> new Item(rs.getLong("id"), rs.getString("item_no"), rs.getString("name"),
                    rs.getString("item_type"), rs.getString("unit"), rs.getLong("price"), rs.getBigDecimal("stock"),
                    rs.getBigDecimal("unavailable"), rs.getBigDecimal("safety_stock"), rs.getInt("lead_time_days")));
        if (items.size() > 10000) throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "MRP 품목 규모 한도를 초과했습니다.");
        if (itemId != null && items.stream().noneMatch(i -> i.id() == itemId)) throw new DomainException(ErrorCode.ITEM_NOT_FOUND, "품목을 찾을 수 없습니다: " + itemId);
        var bom = jdbc.query("select parent_id,child_id,qty,loss_rate from boms order by id limit 50001", p,
                (rs, n) -> new Edge(rs.getLong("parent_id"), rs.getLong("child_id"), rs.getBigDecimal("qty"), rs.getBigDecimal("loss_rate")));
        var work = jdbc.query("""
            select item_id,qty,defect_qty,start_date,due_date from work_orders
            where status in ('지시','진행중') and start_date <= :through order by id limit 10001
            """, p, (rs, n) -> new Work(rs.getLong("item_id"), rs.getBigDecimal("qty"), rs.getBigDecimal("defect_qty"),
                    rs.getObject("start_date", LocalDate.class), rs.getObject("due_date", LocalDate.class)));
        var supply = jdbc.query("""
            select item_id,greatest(qty-received_qty,0) remaining,due_date from purchase_orders
            where status in ('발주','부분입고') order by id limit 10001
            """, p, (rs, n) -> new Supply(rs.getLong("item_id"), rs.getBigDecimal("remaining"), rs.getObject("due_date", LocalDate.class)));
        if (items.size() > 10000 || bom.size() > 50000 || work.size() > 10000 || supply.size() > 10000) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "MRP 입력 규모 한도를 초과했습니다. 일부 데이터만으로 계산하지 않습니다.");
        }
        var all = new MrpCalculator().calculate(items, bom, work, supply, today, through);
        var filtered = all.stream().filter(r -> itemId == null || r.itemId() == itemId).toList();
        int start = Math.min(filtered.size(), page * size), end = Math.min(filtered.size(), start + size);
        return new MrpDto.Response(asOf, "Asia/Seoul", through, itemId, page, size, filtered.size(),
                (filtered.size() + size - 1) / size, work.size(),
                all.stream().filter(r -> r.suggestedPurchaseQty().signum() > 0).count(),
                all.stream().filter(r -> r.suggestedProductionQty().signum() > 0).count(),
                all.stream().filter(r -> r.action().equals("MISSING_BOM")).count(), filtered.subList(start, end), List.of(
                "계획 참고값이며 재고 예약/불출이 아닙니다. 현재 구성품 소비 이력이 없어 활성 오더의 전체 지시수량을 소요량으로 잡습니다. 과거 완료 오더의 미불출 소비는 복원하지 않습니다.",
                "BOM 수량은 부모 1 기본단위당 자품목 기본단위. 손실률은 추가 소요율로 qty×(1+lossRate/100), 각 전개 단계에서 소수 4자리 올림. 품목 간 단위 변환/수량 총합 없음.",
                "부모부터 공유 자품목 소요량을 합산해 정상 가용재고(비정상/만료 Lot 제외)·전체 미입고 발주잔량·활성 오더 예정 양품(qty-defectQty)을 한 번 차감합니다. 부족 반제품만 추가 전개합니다.",
                "미입고 발주는 발주/부분입고의 max(qty-receivedQty,0). 늦은 발주/예정생산도 수량 차감하되 지연 공급량을 별도 표시해 중복 구매 대신 납기 조정을 검토합니다.",
                "소요일은 활성 오더 착수일, 추가 생산 구성품은 부모 소요일-부모 리드타임. 발주 마감일은 소요일-품목 리드타임. 안전재고만의 보충은 계획 종료일을 소요일로 사용합니다.",
                "발주 전환은 실제 발주처·단가·배송예정일을 사용자가 확인하는 기존 purchase-orders POST입니다. 제안은 예약이 아니므로 확정 전 재조회하세요. MOQ/EOQ·대체품 자동선택·통계 예측은 미지원."));
    }
}
