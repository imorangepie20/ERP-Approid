package com.erpapproid.core.api.inventory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import static com.erpapproid.core.api.inventory.LotTraceDto.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class LotTraceService {
    private final NamedParameterJdbcTemplate jdbc;
    private static final Map<String,String> SORTS = Map.of("lotNo","l.lot_no", "qty","l.qty",
            "producedAt","l.produced_at", "expiry","l.expiry");
    private static final String LOT = "select l.*, i.item_no, i.name item_name, i.unit from lots l join items i on i.id=l.item_id ";
    public Page<Row> list(Long itemId, String status, String warehouse, String keyword, String sort, int page, int size) {
        MasterListQuery.positiveId(itemId);
        var pageable=MasterListQuery.pageable(page,size,sort,SORTS.keySet(),"lotNo");
        if (!status.isEmpty() && !Set.of("정상","보류","폐기","유통기한임박").contains(status))
            throw MasterListQuery.invalid("지원하지 않는 Lot 상태입니다.");
        if (warehouse.length()>32) throw MasterListQuery.invalid("창고는32자 이하여야 합니다.");
        Map<String,Object> p=new HashMap<>(); p.put("itemId",itemId==null?0L:itemId); p.put("status",status);
        p.put("warehouse",warehouse.trim()); p.put("keyword",MasterListQuery.keyword(keyword));
        p.put("limit",size); p.put("offset",(long)page*size);
        if (itemId!=null && jdbc.queryForObject("select count(*) from items where id=:itemId",p,Long.class)==0)
            throw new DomainException(ErrorCode.ITEM_NOT_FOUND,"품목을 찾을 수 없습니다.");
        String where="""
            where (:itemId=0 or l.item_id=:itemId) and (:status='' or l.status=:status)
              and (:warehouse='' or l.warehouse=:warehouse)
              and (cast(:keyword as text) is null or lower(l.lot_no) like :keyword escape '!'
                or lower(i.item_no) like :keyword escape '!' or lower(i.name) like :keyword escape '!')
            """;
        long total=jdbc.queryForObject("select count(*) from lots l join items i on i.id=l.item_id "+where,p,Long.class);
        String[] order=sort.split(","); LocalDate today=today();
        var rows=jdbc.query(LOT+where+" order by "+SORTS.get(order[0])+" "+(order[1].equalsIgnoreCase("desc")?"desc":"asc")
                +" nulls last, l.lot_no asc, l.id asc limit :limit offset :offset",p,(r,n)->row(r,today));
        return new PageImpl<>(rows,pageable,total);
    }
    public Detail detail(long id, int page, int size) {
        MasterListQuery.positiveId(id); var pageable=MasterListQuery.pageable(page,size,"txnDate,desc",Set.of("txnDate"),"txnDate");
        Instant asOf=Instant.now(); LocalDate today=asOf.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
        var p=Map.of("id",id,"limit",size,"offset",(long)page*size);
        var lots=jdbc.query(LOT+"where l.id=:id",p,(r,n)->row(r,today));
        if (lots.isEmpty()) throw new DomainException(ErrorCode.LOT_NOT_FOUND,"Lot을 찾을 수 없습니다.");
        long total=jdbc.queryForObject("select count(*) from inventory_transactions where lot_id=:id",p,Long.class);
        // Resolve only explicit receiving/shipment FKs or the stored WORK_ORDER reference with the same item.
        // Never guess a source from a Lot number, manufacture date, or matching quantity.
        var movements=jdbc.query("""
            select t.*, ti.unit, case when r.id is not null then 'RECEIVING' when w.id is not null then 'WORK_ORDER'
              when s.id is not null then 'SHIPMENT' else 'UNLINKED' end source_type,
              coalesce(r.id,w.id,s.id) source_id, coalesce(r.receiving_no,w.work_order_no,s.shipment_no) source_no
            from inventory_transactions t
            join lots l on l.id=t.lot_id join items ti on ti.id=t.item_id
            left join receivings r on r.lot_id=t.lot_id and r.item_id=t.item_id
              and r.item_id=l.item_id
              and (r.inventory_txn_id=t.id or r.reversal_txn_id=t.id)
            left join work_orders w on t.ref_type='WORK_ORDER' and t.ref_no=w.work_order_no
              and w.item_id=t.item_id and w.item_id=l.item_id and t.qty>0 and t.txn_type='생산입고'
            left join shipments s on s.inventory_txn_id=t.id and s.lot_id=t.lot_id and s.item_id=t.item_id
              and s.item_id=l.item_id
            where t.lot_id=:id order by t.txn_date desc,t.id desc limit :limit offset :offset
            """,p,(r,n)->new Movement(r.getLong("id"),r.getLong("item_id"),r.getString("unit"),r.getString("txn_no"),r.getString("txn_type"),r.getBigDecimal("qty"),
                r.getObject("txn_date",LocalDate.class),r.getString("warehouse"),r.getString("ref_type"),r.getString("ref_no"),
                r.getString("source_type"),r.getObject("source_id",Long.class),r.getString("source_no")));
        return new Detail(asOf,"Asia/Seoul",lots.get(0),new PageImpl<>(movements,pageable,total),List.of(
            "Lot 잔량과 창고는 저장된 원천값입니다. 예약/현재고와 대사된 출하 가능량 또는 창고별 재고 잔액이 아닙니다. 보류·해제·폐기 쓰기는 이 화면에서 제공하지 않습니다.",
            "만료는 만료일이 서울 오늘보다 이전, 임박은 오늘부터30일 이내(당일 포함)입니다. 음수 잔량·미래 제조/입고일은 오류로 표시하며 자동 보정하지 않습니다.",
            "수불은 명시적 lot_id 연결만 조회합니다. 입고/출하는 원·역수불 FK, 작업오더는 저장된 WORK_ORDER 참조와 동일 품목으로 확인합니다. 과거 미연결 원천을 번호/수량으로 추정하지 않습니다."));
    }
    private static LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }
    private Row row(ResultSet r,LocalDate today) throws SQLException {
        LocalDate expiry=r.getObject("expiry",LocalDate.class), produced=r.getObject("produced_at",LocalDate.class);
        return new Row(r.getLong("id"),r.getString("lot_no"),r.getLong("item_id"),r.getString("item_no"),r.getString("item_name"),
            r.getString("unit"),r.getString("warehouse"),r.getBigDecimal("qty"),produced,expiry,r.getString("status"),
            expiry!=null && expiry.isBefore(today),expiry!=null && !expiry.isBefore(today) && !expiry.isAfter(today.plusDays(30)),
            r.getBigDecimal("qty").signum()<0 || produced.isAfter(today),today);
    }
}
