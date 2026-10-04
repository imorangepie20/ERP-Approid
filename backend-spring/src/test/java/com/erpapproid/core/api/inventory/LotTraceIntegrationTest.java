package com.erpapproid.core.api.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.erpapproid.core.support.IntegrationTestSupport;

class LotTraceIntegrationTest extends IntegrationTestSupport {
    private static final String PATH="/api/core/lot-traces";
    @Autowired JdbcTemplate jdbc;
    private final LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));
    @Test
    void pages_literal_filters_and_kst_expiry_boundaries_without_mutating_sources() {
        long item=item(); String token=loginAdmin();
        try {
            long lot=lot(item,4,today,today,"정상"), later=lot(item,-1,today.plusDays(1),today.plusDays(31),"보류");
            lot(item,0,today.minusDays(1),today.minusDays(1),"폐기"); long soon=lot(item,2,today,today.plusDays(30),"유통기한임박");
            long audits=jdbc.queryForObject("select count(*) from audit_logs",Long.class);
            var uri=java.net.URI.create(rest.getRootUri()+PATH+"?itemId="+item+"&keyword="+java.net.URLEncoder.encode("추적_100%",java.nio.charset.StandardCharsets.UTF_8));
            var literal=rest.exchange(uri,org.springframework.http.HttpMethod.GET,authEntity(token,null),com.fasterxml.jackson.databind.JsonNode.class);
            assertThat(literal.getBody().path("totalElements").asLong()).isEqualTo(4);
            var d=get(PATH+"/"+lot,token).getBody();
            assertThat(d.path("timeZone").asText()).isEqualTo("Asia/Seoul");
            assertThat(d.path("lot").path("referenceDate").asText()).isEqualTo(today.toString());
            assertThat(d.path("lot").path("expiringSoon").asBoolean()).isTrue();
            assertThat(d.path("lot").path("expired").asBoolean()).isFalse();
            assertThat(d.path("movements").path("content")).isEmpty();
            var invalid=get(PATH+"/"+later,token).getBody().path("lot");
            assertThat(invalid.path("invalid").asBoolean()).isTrue(); assertThat(invalid.path("expiringSoon").asBoolean()).isFalse();
            assertThat(get(PATH+"/"+soon,token).getBody().path("lot").path("expiringSoon").asBoolean()).isTrue();
            var page=get(PATH+"?itemId="+item+"&size=1&sort=expiry,asc",token).getBody();
            assertThat(page.path("totalElements").asLong()).isEqualTo(4);
            assertThat(page.path("content").get(0).path("expired").asBoolean()).isTrue();
            assertThat(get(PATH+"?itemId="+item+"&status=보류&warehouse=검사창고",token).getBody().path("totalElements").asLong()).isEqualTo(1);
            assertThat(get(PATH+"?itemId="+item+"&warehouse=없음",token).getBody().path("content")).isEmpty();
            assertThat(get(PATH+"?itemId="+item+"&page=10000&size=1",token).getBody().path("content")).isEmpty();
            assertThat(jdbc.queryForObject("select count(*) from audit_logs",Long.class)).isEqualTo(audits);
            assertThat(jdbc.queryForObject("select stock from items where id=?",java.math.BigDecimal.class,item)).isEqualByComparingTo("0");
            assertThat(get("/api/core/lots?itemId="+item,token).getBody().isArray()).isTrue();
        } finally { cleanup(item); }
    }
    @Test
    void traces_real_receiving_and_reversal_only_via_linked_transactions() {
        long item=item(); String token=loginAdmin();
        try {
            long vendor=jdbc.queryForObject("select min(id) from partners where partner_type='발주처'",Long.class);
            var po=post("/api/core/purchase-orders",token,body("purchaseOrderNo",key(),"vendorId",vendor,"itemId",item,"qty",10,"unitPrice",100,"dueDate",today.toString()));
            assertThat(po.getStatusCode().value()).isEqualTo(201);
            var receive=post("/api/core/receivings",token,body("purchaseOrderId",po.getBody().path("id").asLong(),"receivedQty",6,"defectQty",1,"receivedDate",today.toString()));
            assertThat(receive.getStatusCode().value()).isEqualTo(201);
            var receipt=receive.getBody().path("receiving"); long receiptId=receipt.path("id").asLong();
            long lot=jdbc.queryForObject("select lot_id from receivings where id=?",Long.class,receiptId);
            var d=get(PATH+"/"+lot,token).getBody(); var movement=d.path("movements").path("content").get(0);
            assertThat(movement.path("sourceType").asText()).isEqualTo("RECEIVING");
            assertThat(movement.path("sourceId").asLong()).isEqualTo(receiptId);
            assertThat(movement.path("qty").decimalValue()).isEqualByComparingTo("5");
            assertThat(post("/api/core/receivings/"+receiptId+"/cancel",token,body()).getStatusCode().value()).isEqualTo(200);
            var cancelled=get(PATH+"/"+lot+"?size=1",token).getBody();
            assertThat(cancelled.path("lot").path("qty").decimalValue()).isEqualByComparingTo("0");
            assertThat(cancelled.path("movements").path("totalElements").asLong()).isEqualTo(2);
            assertThat(cancelled.path("movements").path("content").get(0).path("qty").decimalValue()).isEqualByComparingTo("-5");
            assertThat(cancelled.path("movements").path("content").get(0).path("sourceId").asLong()).isEqualTo(receiptId);
            assertThat(get(PATH+"/"+lot+"?page=1&size=1",token).getBody().path("movements").path("content").get(0).path("txnNo").asText())
                .isEqualTo(receipt.path("inventoryTxnNo").asText());
        } finally { cleanup(item); }
    }
    @Test
    void resolves_stored_production_reference_and_does_not_guess_missing_or_wrong_item_sources() {
        long item=item(); String token=loginAdmin();
        try {
            String number=key();
            var work=post("/api/core/work-orders",token,body("workOrderNo",number,"itemId",item,"qty",4,"startDate",today.toString(),"dueDate",today.toString()));
            assertThat(work.getStatusCode().value()).isEqualTo(201); long id=work.getBody().path("id").asLong();
            assertThat(post("/api/core/work-orders/"+id+"/progress",token,body("goodQty",4,"defectQty",0)).getStatusCode().value()).isEqualTo(200);
            assertThat(post("/api/core/work-orders/"+id+"/complete",token,body()).getStatusCode().value()).isEqualTo(200);
            long lot=jdbc.queryForObject("select lot_id from inventory_transactions where ref_type='WORK_ORDER' and ref_no=?",Long.class,number);
            var original=get(PATH+"/"+lot,token).getBody().path("movements").path("content").get(0);
            assertThat(original.path("sourceType").asText()).isEqualTo("WORK_ORDER"); assertThat(original.path("sourceId").asLong()).isEqualTo(id);
            jdbc.update("insert into inventory_transactions(txn_no,item_id,lot_id,warehouse,txn_type,qty,ref_type,ref_no,txn_date) values(?,?,?,'검사창고','실사',0,'WORK_ORDER',?,?)",key(),item,lot,number,today);
            var unknown=get(PATH+"/"+lot,token).getBody().path("movements").path("content").get(0);
            assertThat(unknown.path("sourceType").asText()).isEqualTo("UNLINKED"); assertThat(unknown.path("sourceId").isNull()).isTrue();
            assertThat(unknown.path("refNo").asText()).isEqualTo(number);
            String other=jdbc.queryForObject("select work_order_no from work_orders where item_id<>? limit 1",String.class,item);
            jdbc.update("insert into inventory_transactions(txn_no,item_id,lot_id,warehouse,txn_type,qty,ref_type,ref_no,txn_date) values(?,?,?,'검사창고','생산입고',1,'WORK_ORDER',?,?)",key(),item,lot,other,today);
            assertThat(get(PATH+"/"+lot,token).getBody().path("movements").path("content").get(0).path("sourceType").asText()).isEqualTo("UNLINKED");
            long historical=lot(item,4,today,null,"정상");
            assertThat(get(PATH+"/"+historical,token).getBody().path("movements").path("content")).isEmpty();
        } finally { cleanup(item); }
    }
    @Test
    void authenticates_all_read_roles_validates_queries_and_rejects_writes() {
        assertThat(rest.getForEntity(PATH,String.class).getStatusCode().value()).isEqualTo(401);
        String token=loginAdmin();
        for (String role:new String[]{"SALES","MATERIAL","PRODUCTION","QUALITY","ACCOUNTING"}) {
            String name="trace-"+role.toLowerCase(); createUser(name,"password123",role);
            assertThat(get(PATH,login(name,"password123")).getStatusCode().value()).isEqualTo(200);
        }
        for (String q:new String[]{"itemId=0","status=bad","warehouse="+"X".repeat(33),"keyword="+"X".repeat(129),"page=-1","size=101","sort=qty,bad","sort=status,asc"}) {
            var r=get(PATH+"?"+q,token); assertThat(r.getStatusCode().value()).as(q).isEqualTo(400);
            assertThat(r.getBody().path("code").asText()).isEqualTo("INVALID_INPUT"); assertThat(r.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        }
        assertThat(get(PATH+"/0",token).getStatusCode().value()).isEqualTo(400);
        assertThat(get(PATH+"/1?size=0",token).getStatusCode().value()).isEqualTo(400);
        assertThat(get(PATH+"/9223372036854775807",token).getStatusCode().value()).isEqualTo(404);
        assertThat(get(PATH+"?itemId=9223372036854775807",token).getStatusCode().value()).isEqualTo(404);
        assertThat(post(PATH,token,body()).getStatusCode().value()).isEqualTo(405);
        var doc=rest.getForEntity("/v3/api-docs",com.fasterxml.jackson.databind.JsonNode.class).getBody();
        assertThat(doc.path("paths").path(PATH).has("get")).isTrue(); assertThat(doc.path("components").path("schemas").has("LotTraceDetail")).isTrue();
    }
    private long item() { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit) values(?,'추적_100%','제품','kg') returning id",Long.class,key()); }
    private long lot(long item,int qty,LocalDate produced,LocalDate expiry,String status) {
        return jdbc.queryForObject("insert into lots(lot_no,item_id,warehouse,qty,produced_at,expiry,status) values(?,?,'검사창고',?,?,?,?) returning id",Long.class,key(),item,qty,produced,expiry,status);
    }
    private String key() { return "LT-"+UUID.randomUUID().toString().replace("-","").substring(0,20); }
    private void cleanup(long item) {
        jdbc.update("delete from receivings where item_id=?",item); jdbc.update("delete from purchase_orders where item_id=?",item);
        jdbc.update("delete from inventory_transactions where item_id=?",item); jdbc.update("delete from lots where item_id=?",item);
        jdbc.update("delete from work_orders where item_id=?",item); jdbc.update("delete from items where id=?",item);
    }
}
