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
import static com.erpapproid.core.api.analytics.InventorySummaryDto.*;

@Service
@RequiredArgsConstructor
public class InventorySummaryService {
    private final NamedParameterJdbcTemplate jdbc;
    private static final Map<String,String> SORTS = Map.of("itemNo","item_no", "currentStock","stock",
            "stockLedgerDelta","stock_delta", "agedLotQty","aged_qty");
    private static final Map<String,String> RISKS = Map.of("all","true", "low","low_stock",
            "ledger","ledger_mismatch", "lots","lot_mismatch", "aged","aged_qty>0");
    private static final String SOURCE = """
        with filtered as (
          select * from items i where (:itemId=0 or i.id=:itemId) and (:itemType='all' or i.item_type=:itemType)
            and (cast(:keyword as text) is null or lower(i.item_no) like :keyword escape '!'
              or lower(i.name) like :keyword escape '!')
        ), movements as (
          select t.item_id, sum(t.qty) balance,
            coalesce(sum(t.qty) filter(where t.txn_date between :from and :to and t.qty>0),0) increase_qty,
            coalesce(-sum(t.qty) filter(where t.txn_date between :from and :to and t.qty<0),0) decrease_qty,
            count(*) filter(where t.txn_date>:today) future_txns
          from inventory_transactions t join filtered i on i.id=t.item_id group by t.item_id
        ), lot_totals as (
          select l.item_id, count(*) lot_count,
            coalesce(sum(l.qty) filter(where l.status<>'폐기' and l.qty>0),0) recorded_qty,
            coalesce(sum(l.qty) filter(where l.qty>0 and l.status in ('정상','유통기한임박')
              and l.produced_at<=:today and (l.expiry is null or l.expiry>=:today)),0) usable_qty,
            coalesce(sum(l.qty) filter(where l.qty>0 and l.status='보류'),0) held_qty,
            coalesce(sum(l.qty) filter(where l.qty>0 and l.status<>'폐기' and l.expiry<:today),0) expired_qty,
            coalesce(sum(l.qty) filter(where l.qty>0 and l.status<>'폐기' and l.produced_at<=:cutoff),0) aged_qty,
            count(*) filter(where l.qty<0 or l.produced_at>:today) invalid_lots
          from lots l join filtered i on i.id=l.item_id group by l.item_id
        ), source as (
          select i.*, coalesce(m.balance,0) balance, i.stock-coalesce(m.balance,0) stock_delta,
            coalesce(m.increase_qty,0) increase_qty, coalesce(m.decrease_qty,0) decrease_qty,
            coalesce(m.future_txns,0) future_txns, coalesce(l.lot_count,0) lot_count,
            coalesce(l.recorded_qty,0) recorded_qty, coalesce(l.usable_qty,0) usable_qty,
            coalesce(l.held_qty,0) held_qty, coalesce(l.expired_qty,0) expired_qty,
            coalesce(l.aged_qty,0) aged_qty, coalesce(l.invalid_lots,0) invalid_lots,
            i.stock<i.safety_stock low_stock, i.stock<>coalesce(m.balance,0) ledger_mismatch,
            i.stock<>coalesce(l.recorded_qty,0) lot_mismatch
          from filtered i left join movements m on m.item_id=i.id left join lot_totals l on l.item_id=i.id
        )
        """;
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Response read(LocalDate requestedFrom, LocalDate requestedTo, int ageDays, Long itemId,
            String itemType, String risk, String keyword, String sort, int page, int size) {
        Instant asOf=Instant.now(); LocalDate today=asOf.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
        LocalDate from=requestedFrom==null ? today.withDayOfMonth(1) : requestedFrom;
        LocalDate to=requestedTo==null ? today : requestedTo;
        if (from.isAfter(to) || to.isAfter(today) || ChronoUnit.DAYS.between(from,to)>=366 || ageDays<1 || ageDays>3650
                || !Set.of("all","제품","반제품","자재").contains(itemType) || !RISKS.containsKey(risk))
            throw MasterListQuery.invalid("과거부터 서울 오늘까지 최대366일, 경과 기준1~3650일과 유효한 품목/위험 범위를 선택하세요.");
        MasterListQuery.positiveId(itemId); MasterListQuery.pageable(page,size,sort,SORTS.keySet(),"itemNo");
        Map<String,Object> p=new HashMap<>(); p.put("from",from); p.put("to",to); p.put("today",today);
        p.put("cutoff",today.minusDays(ageDays)); p.put("itemId",itemId==null?0L:itemId);
        p.put("itemType",itemType); p.put("keyword",MasterListQuery.keyword(keyword));
        p.put("limit",size); p.put("offset",(long)page*size);
        if (itemId!=null && jdbc.queryForObject("select count(*) from items where id=:itemId",p,Long.class)==0)
            throw new DomainException(ErrorCode.ITEM_NOT_FOUND,"품목을 찾을 수 없습니다.");
        String where=" where "+RISKS.get(risk);
        var s=jdbc.queryForMap(SOURCE+"""
          select count(*) total, count(*) filter(where low_stock) low,
            count(*) filter(where ledger_mismatch) ledger, count(*) filter(where lot_mismatch) lots,
            count(*) filter(where aged_qty>0) aged, count(*) filter(where held_qty>0) held,
            count(*) filter(where expired_qty>0) expired,
            coalesce(sum(invalid_lots),0) invalid_lots, coalesce(sum(future_txns),0) future_txns
          from source
          """+where,p);
        long total=count(s,"total"); String[] parts=sort.split(",");
        String order=SORTS.get(parts[0])+(parts[1].equalsIgnoreCase("desc")?" desc":" asc")+", item_no asc, id asc";
        var rows=jdbc.query(SOURCE+"select * from source"+where+" order by "+order+" limit :limit offset :offset",p,
            (r,n)->new Row(r.getLong("id"),r.getString("item_no"),r.getString("name"),r.getString("item_type"),r.getString("unit"),
                r.getBigDecimal("stock"),r.getBigDecimal("safety_stock"),r.getBigDecimal("balance"),r.getBigDecimal("stock_delta"),
                r.getBigDecimal("recorded_qty"),r.getBigDecimal("usable_qty"),r.getBigDecimal("held_qty"),r.getBigDecimal("expired_qty"),
                r.getBigDecimal("aged_qty"),r.getBigDecimal("increase_qty"),r.getBigDecimal("decrease_qty"),
                r.getBigDecimal("increase_qty").subtract(r.getBigDecimal("decrease_qty")),r.getLong("lot_count"),
                r.getLong("invalid_lots"),r.getLong("future_txns"),r.getBoolean("low_stock"),r.getBoolean("ledger_mismatch"),r.getBoolean("lot_mismatch")));
        return new Response(asOf,"Asia/Seoul",from,to,ageDays,itemId,itemType,risk,keyword.trim(),sort,page,size,total,(total+size-1)/size,
            new Summary(total,count(s,"low"),count(s,"ledger"),count(s,"lots"),count(s,"aged"),count(s,"held"),count(s,"expired"),
                count(s,"invalid_lots"),count(s,"future_txns"),null),rows,List.of(
            "현재고는 items.stock, 수불 합계는 저장된 모든 부호 있는 수불의 합입니다. 차이는 현재고−수불 합계이며 초기잔액/과거 누락을 추정하거나 자동 보정하지 않습니다. 미래일 수불도 전체 합계에 포함하되 별도 경고합니다.",
            "기간은 수불일 기준 양수 증가/음수 감소(절댓값)/순증감에만 적용합니다. 입고 취소 보상도 부호대로 포함하며 기간말 재고나 실제 입출고 원가가 아닙니다. 현재고·Lot에는 기간 필터 미적용입니다.",
            "Lot 기록량은 폐기 제외 양수 잔량입니다. 확인된 사용가능 Lot은 정상/유통기한임박, 제조·입고일이 서울 오늘 이하이며 만료일이 없거나 오늘 이상인 양수 잔량입니다. 현재고/예약과 합쳐 출하 가능량으로 확정하지 않습니다.",
            "보류/만료/장기 Lot은 겹칠 수 있어 합산하지 않습니다. 장기는 제조·입고일로부터 기준 일수 이상 경과한 폐기 제외 양수 Lot이며 무출고/마지막 이동 경과일이 아닙니다. 음수 잔량·미래 제조일은 별도 경고합니다.",
            "요약은 모든 적용 필터(위험 포함)의 전체 품목 기준이며 페이지에 제한되지 않습니다. 수량은 행별 품목 단위이고 혼합 단위 총량/추정 창고는 제공하지 않습니다. 창고별 초기잔액·사업장 범위는 후속 업무입니다.",
            "재고회전율은 매출원가와 평균재고 원가 이력이 없어 계산 불가(null)입니다. 기준단가/출하액/현재고로 대체하지 않습니다. 읽기만 제공하며 품목 마스터와 발주제안의 실제 화면으로 연결합니다."));
    }
    private static long count(Map<String,Object> s,String key) { return ((Number)s.get(key)).longValue(); }
}
