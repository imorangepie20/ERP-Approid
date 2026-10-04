package com.erpapproid.core.api.analytics;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import static com.erpapproid.core.api.analytics.ProductionProgressDto.*;

@Service
@RequiredArgsConstructor
public class ProductionProgressService {
    private final NamedParameterJdbcTemplate jdbc;
    private static final Map<String, String> SORTS = Map.of("dueDate", "due_date", "workOrderNo", "work_order_no",
            "progressPercent", "progress_percent", "priority", "priority", "itemNo", "item_no");
    private static final String SOURCE = """
        with source as (
          select w.*, i.item_no, i.name item_name, i.unit,
            w.status in ('지시','진행중') active,
            w.good_qty+w.defect_qty > w.qty over_actual,
            greatest(w.qty-w.good_qty-w.defect_qty,0) remaining_qty,
            case when w.good_qty+w.defect_qty <= w.qty then round(100*(w.good_qty+w.defect_qty)/w.qty,2) end progress_percent,
            case when w.good_qty+w.defect_qty <= w.qty then round(100*w.good_qty/nullif(w.good_qty+w.defect_qty,0),2) end yield_percent,
            w.status in ('지시','진행중') and w.due_date < :today delayed
          from work_orders w join items i on i.id=w.item_id
          where w.due_date between :from and :to and (:itemId=0 or w.item_id=:itemId)
            and (:status='all' or (:status='active' and w.status in ('지시','진행중')) or w.status=:status)
            and (cast(:keyword as text) is null or lower(w.work_order_no) like :keyword escape '!'
              or lower(i.item_no) like :keyword escape '!' or lower(i.name) like :keyword escape '!'
              or lower(w.assignee) like :keyword escape '!')
        )
        """;
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Response read(LocalDate requestedFrom, LocalDate requestedTo, Long itemId, String status,
            String keyword, String sort, int page, int size) {
        Instant asOf = Instant.now(); LocalDate today = asOf.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
        LocalDate from = requestedFrom == null ? today.minusDays(30) : requestedFrom;
        LocalDate to = requestedTo == null ? today.plusDays(30) : requestedTo;
        if (from.isAfter(to) || ChronoUnit.DAYS.between(from, to) >= 366
                || !Set.of("active", "all", "지시", "진행중", "완료", "마감", "취소").contains(status)) {
            throw MasterListQuery.invalid("완료예정일 기간은 최대366일이며 유효한 작업오더 상태를 선택해야 합니다.");
        }
        MasterListQuery.positiveId(itemId);
        MasterListQuery.pageable(page, size, sort, SORTS.keySet(), "workOrderNo");
        String search = MasterListQuery.keyword(keyword);
        Map<String, Object> p = new HashMap<>();
        p.put("today", today); p.put("from", from); p.put("to", to); p.put("itemId", itemId == null ? 0L : itemId);
        p.put("status", status); p.put("keyword", search); p.put("limit", size); p.put("offset", (long)page * size);
        if (itemId != null && jdbc.queryForObject("select count(*) from items where id=:itemId", p, Long.class) == 0) {
            throw new DomainException(ErrorCode.ITEM_NOT_FOUND, "품목을 찾을 수 없습니다: " + itemId);
        }
        var counts = jdbc.queryForMap(SOURCE + """
            select count(*) total, count(*) filter(where active) active,
              count(*) filter(where status in ('완료','마감')) completed, count(*) filter(where status='취소') cancelled,
              count(*) filter(where delayed) delayed, count(*) filter(where active and trim(assignee)='') unassigned,
              count(*) filter(where over_actual) invalid,
              count(*) filter(where active and not over_actual) eligible_active,
              round(avg(progress_percent) filter(where active and not over_actual),2) mean_progress,
              count(*) filter(where status<>'취소' and yield_percent is not null) eligible_yield,
              round(avg(yield_percent) filter(where status<>'취소'),2) mean_yield from source
            """, p);
        String[] parts = sort.split(",");
        String order = SORTS.get(parts[0]) + (parts[1].equalsIgnoreCase("desc") ? " desc" : " asc") + " nulls last, work_order_no asc, id asc";
        var rows = jdbc.query(SOURCE + "select * from source order by " + order + " limit :limit offset :offset", p,
                (rs, n) -> new Row(rs.getLong("id"), rs.getString("work_order_no"), rs.getLong("item_id"), rs.getString("item_no"),
                    rs.getString("item_name"), rs.getString("unit"), rs.getBigDecimal("qty"), rs.getBigDecimal("good_qty"),
                    rs.getBigDecimal("defect_qty"), rs.getBigDecimal("remaining_qty"), rs.getBigDecimal("progress_percent"),
                    rs.getBigDecimal("yield_percent"), rs.getObject("start_date", LocalDate.class), rs.getObject("due_date", LocalDate.class),
                    rs.getString("status"), rs.getString("assignee"), rs.getInt("priority"), rs.getBoolean("delayed"), rs.getBoolean("over_actual")));
        long total = count(counts, "total");
        return new Response(asOf, "Asia/Seoul", from, to, itemId, status, keyword.trim(), sort, page, size, total,
                (total + size - 1) / size, new Summary(total, count(counts,"active"), count(counts,"completed"), count(counts,"cancelled"),
                    count(counts,"delayed"), count(counts,"unassigned"), count(counts,"invalid"), count(counts,"eligible_active"),
                    (BigDecimal)counts.get("mean_progress"), count(counts,"eligible_yield"), (BigDecimal)counts.get("mean_yield")), rows,
                List.of("기간은 완료예정일 기준의 오더 선택입니다. 진척/실적/지연은 조회 시점 현재값이며 과거 종료일의 상태를 복원하지 않습니다. 기본은 서울 오늘±30일의 지시/진행중 오더입니다.",
                    "진척률=(양품+불량)/지시수량×100, 잔량=max(지시-양품-불량,0). 수율=양품/(양품+불량)×100, 실적0이면 수율 없음. 수율은 완료품 검사 결과가 아닌 입력된 누적 실적 기준입니다.",
                    "평균은 오더별 비율의 단순 평균이며 kg/EA 등 다른 단위의 수량을 합산하지 않습니다. 요약은 모든 필터 결과 기준이고 현재 페이지에 제한되지 않습니다.",
                    "지연은 지시/진행중이고 완료예정일이 서울 오늘 이전인 경우만 해당합니다. 오늘 납기·완료/마감/취소는 현재 지연에 포함하지 않습니다.",
                    "과거 초과 실적은 원 수량을 보존하고 비율을 null로 표시해 평균에서 제외합니다. 취소 오더는 진척/수율 평균에서 제외합니다. 실적 합계가 지시량을 넘은 이력은 수정하거나 추정하지 않습니다.",
                    "설비 가동률·실제 공정시간·불량 원인·원가 차이는 원천 이력이 없어 제공하지 않습니다. 영업/재고 분석·회전율은 후속 범위입니다."));
    }
    private static long count(Map<String, Object> counts, String key) { return ((Number)counts.get(key)).longValue(); }
}
