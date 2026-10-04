package com.erpapproid.core.api.analytics;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import static com.erpapproid.core.api.analytics.DashboardDto.*;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private final NamedParameterJdbcTemplate jdbc;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final String SHIPPED = SalesAnalysisSql.VERIFIED_SHIPMENTS;
    // MIN prevents duplicate ledger references from counting one completion twice.
    private static final String COMPLETED = """
        select w.id, w.item_id, w.good_qty, w.defect_qty, i.price, min(t.txn_date) completed_date
        from work_orders w join items i on i.id = w.item_id
        join inventory_transactions t on t.ref_type = 'WORK_ORDER' and t.ref_no = w.work_order_no
            and t.item_id = w.item_id and t.txn_type = '생산입고'
        where w.status in ('완료','마감')
        group by w.id, w.item_id, w.good_qty, w.defect_qty, i.price
        """;
    private static final String COHORT = """
        with shipped as (%s), cohort as (
          select o.id, o.qty, o.status,
            coalesce(sum(s.qty),0) shipped_qty,
            coalesce(sum(s.qty) filter (where s.confirmed_date <= o.due_date),0) on_time_qty,
            exists(select 1 from shipments h where h.sales_order_id = o.id
              and h.status in ('출하완료','매출반영')
              and (h.confirmed_date is null or h.inventory_txn_id is null or h.receivable_id is null)) legacy
          from sales_orders o left join shipped s on s.sales_order_id = o.id
          where o.status in ('확정','생산중','출하완료') and o.due_date between :from and :to
            and o.due_date < :today and (:itemId = 0 or o.item_id = :itemId)
          group by o.id, o.qty, o.status
        ), classified as (
          select *, (legacy or (status = '출하완료' and shipped_qty < qty)) unknown from cohort
        )
        """.formatted(SHIPPED);

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Response read(LocalDate requestedFrom, LocalDate requestedTo, Long itemId) {
        Instant asOf = Instant.now();
        LocalDate today = asOf.atZone(SEOUL).toLocalDate();
        LocalDate from = requestedFrom == null ? today.withDayOfMonth(1) : requestedFrom;
        LocalDate to = requestedTo == null ? today : requestedTo;
        if (from.isAfter(to) || to.isAfter(today) || ChronoUnit.DAYS.between(from, to) >= 366
                || itemId != null && itemId <= 0) {
            throw new DomainException(ErrorCode.INVALID_INPUT, "기간은 과거부터 오늘까지 최대 366일이며 품목 ID는 양수여야 합니다.");
        }
        Map<String, Object> p = new HashMap<>();
        p.put("from", from); p.put("to", to); p.put("today", today); p.put("itemId", itemId == null ? 0L : itemId);
        if (itemId != null && jdbc.queryForObject("select count(*) from items where id = :itemId", p, Long.class) == 0) {
            throw new DomainException(ErrorCode.ITEM_NOT_FOUND, "품목을 찾을 수 없습니다: " + itemId);
        }
        var sales = jdbc.queryForMap("with shipped as (" + SHIPPED + """
            ) select coalesce(sum(amount),0) revenue from shipped
            where confirmed_date between :from and :to and (:itemId = 0 or item_id = :itemId)
            """, p);
        var production = jdbc.queryForMap("with completed as (" + COMPLETED + """
            ) select coalesce(sum(floor(good_qty * price)),0) value, count(*) count,
              round(avg(100 * defect_qty / nullif(good_qty + defect_qty,0)),2) defect_rate
            from completed where completed_date between :from and :to and (:itemId = 0 or item_id = :itemId)
            """, p);
        var backlog = jdbc.queryForMap("with shipped as (" + SHIPPED + """
            ) select coalesce(sum(greatest(o.amount - coalesce(s.amount,0),0)),0) value, count(*) count
            from sales_orders o left join (select sales_order_id,sum(amount) amount from shipped group by sales_order_id) s
              on s.sales_order_id = o.id
            where o.status in ('확정','생산중') and (:itemId = 0 or o.item_id = :itemId)
            """, p);
        var delivery = jdbc.queryForMap(COHORT + """
            select count(*) filter (where not unknown) eligible,
              count(*) filter (where not unknown and on_time_qty >= qty) on_time,
              count(*) filter (where unknown) unknown from classified
            """, p);
        long eligible = count(delivery, "eligible"), onTime = count(delivery, "on_time");
        var kpis = new Kpis(decimal(sales, "revenue"), decimal(production, "value"), decimal(backlog, "value"),
                count(backlog, "count"), eligible == 0 ? null : BigDecimal.valueOf(onTime * 100)
                    .divide(BigDecimal.valueOf(eligible), 2, RoundingMode.HALF_UP), onTime, eligible,
                decimal(production, "defect_rate"), count(production, "count"), null,
                "매출원가와 기간 평균 재고원가 이력이 없어 계산할 수 없습니다. 현재 품목 단가로 원가를 추정하지 않습니다.");
        long undatedShips = jdbc.queryForObject("""
            select count(*) from shipments where status in ('출하완료','매출반영')
              and (confirmed_date is null or inventory_txn_id is null or receivable_id is null)
              and (:itemId = 0 or item_id = :itemId)
            """, p, Long.class);
        long undatedWork = jdbc.queryForObject("with completed as (" + COMPLETED + """
            ) select count(*) from work_orders w where w.status in ('완료','마감')
            and (:itemId = 0 or w.item_id = :itemId) and not exists(select 1 from completed c where c.id = w.id)
            """, p, Long.class);
        return new Response(new Metadata(asOf, "Asia/Seoul", from, to, itemId, "수주잔고·위험 알림·이력 미확인 건수는 현재 스냅샷"),
                kpis, trends(p, from, to), alerts(p), new Coverage(undatedShips, undatedWork, count(delivery, "unknown"), List.of(
                "매출: 실제 출하확정일·수불·미수금 연결이 있는 출하 금액 합계. 취소/미확정/과거 미연결 출하는 제외.",
                "생산액: 생산입고일이 확인된 완료/마감 오더의 양품 × 조회 시점 품목 기준단가, 오더별 원 미만 절사. 실제 제조원가가 아님.",
                "수주잔고: 현재 확정/생산중 수주 금액에서 확정 출하 금액 차감. 기간 필터 미적용.",
                "납기준수율: 조회기간 내 납기가 지난(오늘 제외) 확정/생산중/출하완료 수주 중 납기일까지 전량 출하확정한 비율. 이력 미확인 수주는 분모에서도 제외.",
                "오더 평균 불량률: 생산입고일 기준 완료/마감 오더의 불량/(양품+불량)×100을 오더별 산출 후 단순 평균. 서로 다른 품목 단위의 수량을 합산하지 않음.",
                "이력 미확인 출하/완료 오더 건수는 날짜를 알 수 없어 기간 필터를 적용하지 않음. 재고회전율은 원가 이력 구축 후 제공.")));
    }

    private List<Trend> trends(Map<String, Object> p, LocalDate from, LocalDate to) {
        Map<String, BigDecimal> revenue = new HashMap<>(), production = new HashMap<>();
        jdbc.query("with shipped as (" + SHIPPED + """
            ) select to_char(confirmed_date,'YYYY-MM') as period_month, sum(amount) value from shipped
            where confirmed_date between :from and :to and (:itemId = 0 or item_id = :itemId) group by 1
            """, p, rs -> { revenue.put(rs.getString("period_month"), rs.getBigDecimal("value")); });
        jdbc.query("with completed as (" + COMPLETED + """
            ) select to_char(completed_date,'YYYY-MM') as period_month, sum(floor(good_qty * price)) value from completed
            where completed_date between :from and :to and (:itemId = 0 or item_id = :itemId) group by 1
            """, p, rs -> { production.put(rs.getString("period_month"), rs.getBigDecimal("value")); });
        List<Trend> result = new ArrayList<>();
        for (YearMonth month = YearMonth.from(from); !month.isAfter(YearMonth.from(to)); month = month.plusMonths(1)) {
            String key = month.toString(); result.add(new Trend(key, revenue.getOrDefault(key, BigDecimal.ZERO), production.getOrDefault(key, BigDecimal.ZERO)));
        }
        return result;
    }

    private Alerts alerts(Map<String, Object> p) {
        String risks = """
            select 'LOW_STOCK' kind, item_no reference_no, name item_name,
              '현재고 ' || stock || ' / 안전재고 ' || safety_stock || ' ' || unit message, '/items' path
            from items where stock < safety_stock and (:itemId = 0 or id = :itemId)
            union all
            select 'OVERDUE_WORK_ORDER', w.work_order_no, i.name, '완료예정 ' || w.due_date, '/production/orders'
            from work_orders w join items i on i.id = w.item_id
            where w.status in ('지시','진행중') and w.due_date < :today and (:itemId = 0 or w.item_id = :itemId)
            union all
            select 'OVERDUE_SALES_ORDER', o.sales_order_no, i.name, '납기 ' || o.due_date, '/sales/orders'
            from sales_orders o join items i on i.id = o.item_id
            where o.status in ('확정','생산중') and o.due_date < :today and (:itemId = 0 or o.item_id = :itemId)
            """;
        var counts = jdbc.queryForMap("with risks as (" + risks + """
            ) select count(*) total, count(*) filter (where kind='LOW_STOCK') stock,
              count(*) filter (where kind='OVERDUE_WORK_ORDER') work,
              count(*) filter (where kind='OVERDUE_SALES_ORDER') sales from risks
            """, p);
        var rows = jdbc.query("with risks as (" + risks + ") select * from risks order by kind,reference_no limit 20", p,
                (rs, n) -> new Alert(rs.getString("kind"), rs.getString("reference_no"), rs.getString("item_name"),
                        rs.getString("message"), rs.getString("path")));
        long total = count(counts, "total");
        return new Alerts(count(counts, "stock"), count(counts, "work"), count(counts, "sales"), total, total > rows.size(), rows);
    }
    private static BigDecimal decimal(Map<String, Object> m, String key) {
        Object value = m.get(key); return value == null ? null : new BigDecimal(value.toString());
    }
    private static long count(Map<String, Object> m, String key) { return ((Number) m.get(key)).longValue(); }
}
