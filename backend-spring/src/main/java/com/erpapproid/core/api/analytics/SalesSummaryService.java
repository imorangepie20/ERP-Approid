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
import static com.erpapproid.core.api.analytics.SalesSummaryDto.*;

@Service
@RequiredArgsConstructor
public class SalesSummaryService {
    private final NamedParameterJdbcTemplate jdbc;
    private static final Map<String,String> SORTS = Map.of("orderedAt","ordered_at", "dueDate","due_date",
            "salesOrderNo","sales_order_no", "amountKrw","amount", "openReceivableKrw","open_ar");
    private static final String SOURCE = """
        with verified as (%s), filtered as (
          select o.*, p.partner_no customer_no, p.name customer_name, i.item_no, i.name item_name, i.unit
          from sales_orders o join partners p on p.id=o.customer_id join items i on i.id=o.item_id
          where (:itemId=0 or o.item_id=:itemId) and (:customerId=0 or o.customer_id=:customerId)
            and (cast(:keyword as text) is null or lower(o.sales_order_no) like :keyword escape '!'
              or lower(p.partner_no) like :keyword escape '!' or lower(p.name) like :keyword escape '!'
              or lower(i.item_no) like :keyword escape '!' or lower(i.name) like :keyword escape '!')
        ), shipped as (
          select s.sales_order_id, sum(s.qty) shipped_qty, sum(s.amount) shipped_amount,
            coalesce(sum(s.amount) filter(where s.confirmed_date between :from and :to),0) period_revenue,
            count(*) filter(where s.confirmed_date between :from and :to) period_shipments
          from verified s join filtered o on o.id=s.sales_order_id group by s.sales_order_id
        ), ar as (
          select r.sales_order_id, sum(r.amount) open_ar, count(*) open_count,
            coalesce(sum(r.amount) filter(where r.due_date < :today),0) overdue_ar,
            count(*) filter(where r.due_date < :today) overdue_count
          from receivables r join filtered o on o.id=r.sales_order_id
          where r.status<>'수납완료' group by r.sales_order_id
        ), classified as (
          select o.*, coalesce(s.shipped_qty,0) shipped_qty, coalesce(s.shipped_amount,0) shipped_amount,
            coalesce(s.period_revenue,0) period_revenue, coalesce(s.period_shipments,0) period_shipments,
            coalesce(a.open_ar,0) open_ar, coalesce(a.open_count,0) open_count,
            coalesce(a.overdue_ar,0) overdue_ar, coalesce(a.overdue_count,0) overdue_count,
            o.status in ('확정','생산중') active,
            o.status in ('확정','생산중') and o.due_date < :today delayed,
            (exists(select 1 from shipments h where h.sales_order_id=o.id and h.status in ('출하완료','매출반영')
                and (h.confirmed_date is null or h.inventory_txn_id is null or h.receivable_id is null))
              or coalesce(s.shipped_qty,0)>o.qty or coalesce(s.shipped_amount,0)>o.amount
              or (o.status='출하완료' and coalesce(s.shipped_qty,0)<o.qty)) history_unknown
          from filtered o left join shipped s on s.sales_order_id=o.id left join ar a on a.sales_order_id=o.id
        ), source as (
          select *, case when history_unknown then null when active then greatest(amount-shipped_amount,0) else 0 end backlog
          from classified
        )
        """.formatted(SalesAnalysisSql.VERIFIED_SHIPMENTS);
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Response read(LocalDate requestedFrom, LocalDate requestedTo, Long itemId, Long customerId,
            String keyword, String scope, String sort, int page, int size) {
        Instant asOf=Instant.now(); LocalDate today=asOf.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
        LocalDate from=requestedFrom==null ? today.withDayOfMonth(1) : requestedFrom;
        LocalDate to=requestedTo==null ? today : requestedTo;
        if (from.isAfter(to) || to.isAfter(today) || ChronoUnit.DAYS.between(from,to)>=366
                || !Set.of("ordered","backlog","receivables").contains(scope)) throw MasterListQuery.invalid("과거부터 서울 오늘까지 최대366일, 유효한 목록 범위를 선택하세요.");
        MasterListQuery.positiveId(itemId); MasterListQuery.positiveId(customerId);
        MasterListQuery.pageable(page,size,sort,SORTS.keySet(),"salesOrderNo");
        Map<String,Object> p=new HashMap<>();
        p.put("from",from); p.put("to",to); p.put("today",today); p.put("itemId",itemId==null?0L:itemId);
        p.put("customerId",customerId==null?0L:customerId); p.put("keyword",MasterListQuery.keyword(keyword));
        p.put("limit",size); p.put("offset",(long)page*size);
        if (itemId!=null && jdbc.queryForObject("select count(*) from items where id=:itemId",p,Long.class)==0)
            throw new DomainException(ErrorCode.ITEM_NOT_FOUND,"품목을 찾을 수 없습니다.");
        if (customerId!=null && jdbc.queryForObject("select count(*) from partners where id=:customerId and partner_type='고객사'",p,Long.class)==0)
            throw new DomainException(ErrorCode.NOT_FOUND,"고객사를 찾을 수 없습니다.");
        var s=jdbc.queryForMap(SOURCE+"""
          select count(*) filter(where ordered_at between :from and :to) period_orders,
            count(*) filter(where ordered_at between :from and :to and status='취소') period_cancelled,
            coalesce(sum(amount) filter(where ordered_at between :from and :to and status<>'취소'),0) period_order_amount,
            coalesce(sum(period_shipments),0) period_shipments, coalesce(sum(period_revenue),0) period_revenue,
            count(*) filter(where active) backlog_orders, count(*) filter(where active and history_unknown) unknown_backlog,
            coalesce(sum(backlog) filter(where active and not history_unknown),0) known_backlog,
            coalesce(sum(open_count),0) open_count, coalesce(sum(open_ar),0) open_ar,
            coalesce(sum(overdue_count),0) overdue_count, coalesce(sum(overdue_ar),0) overdue_ar,
            (select count(*) from shipments h join filtered o on o.id=h.sales_order_id
               where h.status in ('출하완료','매출반영') and (h.confirmed_date is null or h.inventory_txn_id is null or h.receivable_id is null)) excluded_shipments
          from source
          """,p);
        long unlinked=jdbc.queryForObject("select count(*) from receivables where sales_order_id is null and (:customerId=0 or customer_id=:customerId)",p,Long.class);
        String where=switch(scope) { case "backlog" -> "active"; case "receivables" -> "open_count>0"; default -> "ordered_at between :from and :to"; };
        long total=jdbc.queryForObject(SOURCE+"select count(*) from source where "+where,p,Long.class);
        String[] parts=sort.split(","); String order=SORTS.get(parts[0])+(parts[1].equalsIgnoreCase("desc")?" desc":" asc")+", sales_order_no asc, id asc";
        var rows=jdbc.query(SOURCE+"select * from source where "+where+" order by "+order+" limit :limit offset :offset",p,
            (r,n)->new Row(r.getLong("id"),r.getString("sales_order_no"),r.getLong("customer_id"),r.getString("customer_no"),r.getString("customer_name"),
                r.getLong("item_id"),r.getString("item_no"),r.getString("item_name"),r.getString("unit"),r.getBigDecimal("qty"),r.getBigDecimal("amount"),
                r.getObject("ordered_at",LocalDate.class),r.getObject("due_date",LocalDate.class),r.getString("status"),r.getBigDecimal("shipped_qty"),
                r.getBigDecimal("shipped_amount"),r.getBigDecimal("period_revenue"),r.getBigDecimal("backlog"),r.getBigDecimal("open_ar"),r.getBigDecimal("overdue_ar"),
                r.getBoolean("history_unknown"),r.getBoolean("delayed")));
        return new Response(asOf,"Asia/Seoul",from,to,itemId,customerId,keyword.trim(),scope,sort,page,size,total,(total+size-1)/size,
            new Summary(count(s,"period_orders"),count(s,"period_cancelled"),money(s,"period_order_amount"),count(s,"period_shipments"),money(s,"period_revenue"),
                count(s,"backlog_orders"),count(s,"unknown_backlog"),money(s,"known_backlog"),count(s,"open_count"),money(s,"open_ar"),count(s,"overdue_count"),
                money(s,"overdue_ar"),count(s,"excluded_shipments"),unlinked),rows,List.of(
            "기간 수주는 수주일 기준이며 취소 금액 제외. 기간 매출은 실제 출하확정일·수불·미수 연결이 있는 출하 금액만 합산합니다. 이는 회계 전표/매출원가가 아닙니다.",
            "현재 잔고는 확정/생산중 수주 금액에서 모든 확인된 확정 출하 금액을 차감합니다. 과거 미연결/초과/완료 불일치 이력이 있으면 잔고를 알 수 없어 null로 표시하고 확인된 잔고 합에서 제외합니다.",
            "현재 미수는 수주에 연결된 미수/연체 문서의 원금 합이며 수납완료 제외. 연체는 서울 오늘 이전 기일만 해당합니다. 수납일·부분수납 이력이 없어 기간 수납액/실제 잔액을 추정하지 않습니다.",
            "요약은 품목·고객·검색의 모든 결과 기준이고 목록 범위/페이지에 제한되지 않습니다. 잔고·미수 목록과 현재 금액은 기간 필터 미적용이며 과거 종료일 상태를 복원하지 않습니다.",
            "미연결 출하 제외 건수는 날짜 불명으로 기간 필터 미적용. 수주 미연결 미수 제외 건수는 고객 필터만 적용하며 품목·검색·기간을 알 수 없어 적용하지 않습니다. 이력을 정상 수치로 추정하지 않습니다.",
            "수량은 행마다 품목 단위를 유지하며 서로 다른 단위를 합산하지 않습니다. 기존 미수 권한에 맞춰 ADMIN/SALES/ACCOUNTING만 조회합니다. 수주/출하만 실제 업무 화면으로 연결하며 미수 프로토타입으로 이동하지 않습니다."));
    }
    private static long count(Map<String,Object> s,String key) { return ((Number)s.get(key)).longValue(); }
    private static BigDecimal money(Map<String,Object> s,String key) { return new BigDecimal(s.get(key).toString()); }
}
