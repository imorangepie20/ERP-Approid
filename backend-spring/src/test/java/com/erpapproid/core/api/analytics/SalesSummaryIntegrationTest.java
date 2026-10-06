package com.erpapproid.core.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpMethod;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

class SalesSummaryIntegrationTest extends IntegrationTestSupport {
    private static final String PATH="/api/core/analytics/sales/summary";
    @Autowired JdbcTemplate jdbc;
    private final LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));
    @Test
    void separates_period_events_from_current_balances_without_join_multiplication_or_legacy_inference() {
        long customer=customer(), item=item();
        try {
            long old=order(item,customer,"생산중",today.minusDays(30));
            ship(item,customer,old,2,200,today.minusDays(10),today.minusDays(1),true,false);
            ship(item,customer,old,3,300,today.minusDays(1),today,true,false);
            ar(customer,old,50,today.minusDays(1),false);
            long closed=order(item,customer,"출하완료",today);
            ship(item,customer,closed,10,1000,today,today.minusDays(1),true,true);
            order(item,customer,"대기",today); order(item,customer,"취소",today);
            long legacy=order(item,customer,"확정",today.minusDays(30));
            ship(item,customer,legacy,2,200,today,today,true,false);
            jdbc.update("update shipments set confirmed_date=null,inventory_txn_id=null,receivable_id=null where sales_order_id=?",legacy);
            // The AR created for this legacy test remains linked to the real order, but not recognized as revenue.
            long unlinkedBefore=jdbc.queryForObject("select count(*) from receivables where sales_order_id is null",Long.class);
            ar(customer,null,999,today.minusDays(1),false);
            long audit=jdbc.queryForObject("select count(*) from audit_logs",Long.class);
            var d=get(query(item)+"&customerId="+customer+"&size=1",loginAdmin()).getBody(); var s=d.path("summary");
            assertThat(d.path("rows")).hasSize(1); assertThat(d.path("totalElements").asInt()).isEqualTo(3);
            assertThat(s.path("periodOrders").asInt()).isEqualTo(3); assertThat(s.path("periodCancelledOrders").asInt()).isEqualTo(1);
            number(s,"periodOrderKrw",2000); number(s,"periodRevenueKrw",1300);
            assertThat(s.path("periodConfirmedShipments").asInt()).isEqualTo(2);
            assertThat(s.path("currentBacklogOrders").asInt()).isEqualTo(2); assertThat(s.path("unknownBacklogOrders").asInt()).isEqualTo(1);
            number(s,"knownCurrentBacklogKrw",500); number(s,"currentOpenReceivableKrw",750); number(s,"currentOverdueReceivableKrw",250);
            assertThat(s.path("currentOpenReceivables").asInt()).isEqualTo(4);
            assertThat(s.path("excludedHistoricalShipments").asInt()).isEqualTo(1); assertThat(s.path("excludedUnlinkedReceivables").asInt()).isEqualTo(1);
            assertThat(get(query(item),loginAdmin()).getBody().path("summary").path("excludedUnlinkedReceivables").asLong()).isEqualTo(unlinkedBefore+1);
            var backlog=get(query(item)+"&scope=backlog",loginAdmin()).getBody();
            assertThat(backlog.path("totalElements").asInt()).isEqualTo(2);
            boolean sawUnknown=false;
            for(var row:backlog.path("rows")) { assertThat(row.path("unit").asText()).isEqualTo("EA"); if(row.path("historyUnknown").asBoolean()) { sawUnknown=true; assertThat(row.path("currentBacklogKrw").isNull()).isTrue(); } }
            assertThat(sawUnknown).isTrue();
            assertThat(get(query(item)+"&scope=receivables",loginAdmin()).getBody().path("totalElements").asInt()).isEqualTo(2);
            assertThat(jdbc.queryForObject("select stock from items where id=?",java.math.BigDecimal.class,item)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from audit_logs",Long.class)).isEqualTo(audit);
        } finally { cleanup(item,customer); }
    }
    @Test
    void filters_literal_customer_keyword_and_zero_fills_without_changing_current_period_rules() {
        long customer=customer(),item=item();
        try {
            order(item,customer,"확정",today);
            var uri=java.net.URI.create(rest.getRootUri()+query(item)+"&customerId="+customer+"&keyword="+java.net.URLEncoder.encode("고객_100%",java.nio.charset.StandardCharsets.UTF_8));
            var d=rest.exchange(uri,HttpMethod.GET,authEntity(loginAdmin(),null),JsonNode.class).getBody();
            assertThat(d.path("rows")).hasSize(1); number(d.path("summary"),"knownCurrentBacklogKrw",1000);
            number(d.path("summary"),"periodRevenueKrw",0);
            assertThat(get(query(item)+"&page=10000",loginAdmin()).getBody().path("rows")).isEmpty();
            assertThat(get(query(item)+"&keyword=absent",loginAdmin()).getBody().path("totalElements").asInt()).isZero();
        } finally { cleanup(item,customer); }
    }
    @Test
    void keeps_receivable_role_boundary_read_only_and_validates_schema_and_inputs() {
        assertThat(rest.getForEntity(PATH,JsonNode.class).getStatusCode().value()).isEqualTo(401);
        for(String role:new String[]{"SALES","ACCOUNTING","MATERIAL","PRODUCTION","QUALITY"}) {
            String username="sales-analysis-"+role.toLowerCase(); createUser(username,"password123",role);
            assertThat(get(PATH,login(username,"password123")).getStatusCode().value()).isEqualTo(role.equals("SALES")||role.equals("ACCOUNTING")?200:403);
        }
        String token=loginAdmin();
        for(String query:new String[]{"from=bad","from="+today+"&to="+today.minusDays(1),"to="+today.plusDays(1),"from="+today.minusDays(366),
                "page=-1","size=101","itemId=0","customerId=-1","scope=bad","sort=amount;drop,asc","keyword="+"X".repeat(129)}) {
            var r=get(PATH+"?"+query,token); assertThat(r.getStatusCode().value()).isEqualTo(400);
            assertThat(r.getBody().path("code").asText()).isEqualTo("INVALID_INPUT"); assertThat(r.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        }
        assertThat(get(PATH+"?customerId=9223372036854775807",token).getStatusCode().value()).isEqualTo(404);
        assertThat(get(PATH+"?itemId=9223372036854775807",token).getStatusCode().value()).isEqualTo(404);
        assertThat(post(PATH,token,body()).getStatusCode().value()).isEqualTo(405);
        var doc=rest.getForEntity("/v3/api-docs",JsonNode.class).getBody();
        assertThat(doc.path("components").path("schemas").has("SalesAnalysisResponse")).isTrue();
        assertThat(doc.path("paths").path(PATH).has("post")).isFalse();
    }
    private long customer() { return jdbc.queryForObject("insert into partners(partner_no,name,partner_type) values(?,'고객_100%','고객사') returning id",Long.class,key()); }
    private long item() { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price) values(?,'영업 분석 제품','제품','EA',100) returning id",Long.class,key()); }
    private long order(long item,long customer,String status,LocalDate date) { return jdbc.queryForObject("insert into sales_orders(sales_order_no,customer_id,item_id,qty,unit_price,amount,due_date,status,ordered_at) values(?,?,?,10,100,1000,?,?,?) returning id",Long.class,key(),customer,item,today.minusDays(1),status,date); }
    private long ar(long customer,Long order,int amount,LocalDate due,boolean paid) { return jdbc.queryForObject("insert into receivables(receivable_no,customer_id,sales_order_id,amount,due_date,status,collected_amount,opening_collected_amount) values(?,?,?,?,?,?,?,?) returning id",Long.class,key(),customer,order,amount,due,paid?"수납완료":"미수",paid?amount:0,paid?amount:0); }
    private void ship(long item,long customer,long order,int qty,int amount,LocalDate confirmed,LocalDate due,boolean linked,boolean paid) {
        String no=key(); Long txn=linked?jdbc.queryForObject("insert into inventory_transactions(txn_no,item_id,warehouse,txn_type,qty,ref_type,ref_no,txn_date) values(?,?,'완제품창고','출하',?,'SHIPMENT',?,?) returning id",Long.class,key(),item,-qty,no,confirmed):null;
        Long r=linked?ar(customer,order,amount,due,paid):null;
        jdbc.update("insert into shipments(shipment_no,sales_order_id,customer_id,item_id,qty,amount,delivery_date,status,confirmed_date,inventory_txn_id,receivable_id) values(?,?,?,?,?,?,?,'출하완료',?,?,?)",no,order,customer,item,qty,amount,confirmed,linked?confirmed:null,txn,r);
    }
    private String query(long item) { return PATH+"?itemId="+item+"&from="+today.minusDays(2)+"&to="+today; }
    private String key() { return "SA-"+UUID.randomUUID().toString().replace("-","").substring(0,20); }
    private void number(JsonNode n,String field,int value) { assertThat(n.path(field).decimalValue()).isEqualByComparingTo(String.valueOf(value)); }
    private void cleanup(long item,long customer) {
        jdbc.update("delete from shipments where item_id=?",item); jdbc.update("delete from receivables where customer_id=?",customer);
        jdbc.update("delete from inventory_transactions where item_id=?",item); jdbc.update("delete from sales_orders where item_id=?",item);
        jdbc.update("delete from items where id=?",item); jdbc.update("delete from partners where id=?",customer);
    }
}
