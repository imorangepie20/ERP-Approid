package com.erpapproid.core.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.erpapproid.core.support.IntegrationTestSupport;

class InventorySummaryIntegrationTest extends IntegrationTestSupport {
    private static final String PATH="/api/core/analytics/inventory/summary";
    @Autowired JdbcTemplate jdbc;
    private final LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));
    @Test
    void separates_current_stock_all_signed_ledger_and_period_reversals_without_join_multiplication() {
        long item=item("kg",30,40); String token=loginAdmin();
        try {
            movement(item,100,today.minusDays(40)); movement(item,10,today); movement(item,-5,today);
            movement(item,-2,today); movement(item,1,today.plusDays(1));
            lot(item,10,90,today,"정상"); lot(item,7,91,today.minusDays(1),"보류");
            lot(item,3,89,null,"정상"); lot(item,5,100,null,"폐기");
            lot(item,0,200,today.minusDays(1),"정상"); lot(item,-2,50,null,"정상"); lot(item,4,-1,null,"정상");
            long audit=jdbc.queryForObject("select count(*) from audit_logs",Long.class);
            var response=get(PATH+"?itemId="+item+"&from="+today+"&to="+today,token);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            var d=response.getBody(); var row=d.path("rows").get(0); var s=d.path("summary");
            assertThat(row.path("unit").asText()).isEqualTo("kg");
            money(row,"currentStock","30"); money(row,"ledgerBalance","104"); money(row,"stockLedgerDelta","-74");
            money(row,"periodIncreaseQty","10"); money(row,"periodDecreaseQty","7"); money(row,"periodNetQty","3");
            money(row,"recordedLotQty","24"); money(row,"knownUsableLotQty","13");
            money(row,"heldLotQty","7"); money(row,"expiredLotQty","7"); money(row,"agedLotQty","17");
            assertThat(row.path("lotCount").asLong()).isEqualTo(7);
            assertThat(row.path("invalidLots").asLong()).isEqualTo(2);
            assertThat(row.path("futureTransactions").asLong()).isEqualTo(1);
            for (String key:new String[]{"lowStock","ledgerMismatch","lotMismatch"}) assertThat(row.path(key).asBoolean()).isTrue();
            for (String key:new String[]{"totalItems","lowStockItems","ledgerMismatchItems","lotMismatchItems","agedItems","heldItems","expiredItems"})
                assertThat(s.path(key).asLong()).isEqualTo(1);
            assertThat(s.path("inventoryTurnover").isNull()).isTrue();
            var older=get(PATH+"?itemId="+item+"&ageDays=91&from="+today.minusDays(10)+"&to="+today.minusDays(1),token).getBody().path("rows").get(0);
            money(older,"agedLotQty","7"); money(older,"currentStock","30"); money(older,"periodNetQty","0");
            assertThat(jdbc.queryForObject("select stock from items where id=?",BigDecimal.class,item)).isEqualByComparingTo("30");
            assertThat(jdbc.queryForObject("select count(*) from audit_logs",Long.class)).isEqualTo(audit);
        } finally { cleanup(item); }
    }
    @Test
    void filters_literal_item_search_risks_type_and_pages_and_zero_fills_missing_sources() {
        long item=item("EA",0,0); String token=loginAdmin();
        try {
            var uri=java.net.URI.create(rest.getRootUri()+PATH+"?itemId="+item+"&keyword="
                +java.net.URLEncoder.encode("재고_100%",java.nio.charset.StandardCharsets.UTF_8));
            var d=rest.exchange(uri,org.springframework.http.HttpMethod.GET,authEntity(token,null),com.fasterxml.jackson.databind.JsonNode.class).getBody();
            assertThat(d.path("rows")).hasSize(1);
            var row=d.path("rows").get(0);
            for (String key:new String[]{"currentStock","ledgerBalance","recordedLotQty","knownUsableLotQty","periodNetQty"}) money(row,key,"0");
            assertThat(row.path("lowStock").asBoolean()).isFalse();
            assertThat(row.path("ledgerMismatch").asBoolean()).isFalse();
            assertThat(get(PATH+"?itemId="+item+"&itemType=자재",token).getBody().path("rows")).isEmpty();
            assertThat(get(PATH+"?itemId="+item+"&risk=low",token).getBody().path("summary").path("totalItems").asLong()).isZero();
            lot(item,1,90,null,"정상");
            var risk=get(PATH+"?itemId="+item+"&risk=aged&size=1",token).getBody();
            assertThat(risk.path("summary").path("agedItems").asLong()).isEqualTo(1);
            var beyond=get(PATH+"?itemId="+item+"&risk=aged&page=10000&size=1",token).getBody();
            assertThat(beyond.path("rows")).isEmpty();
            assertThat(beyond.path("summary")).isEqualTo(risk.path("summary"));
            assertThat(get(PATH+"?itemId="+item+"&keyword=not-found",token).getBody().path("summary").path("totalItems").asLong()).isZero();
            for (String sort:new String[]{"itemNo,asc","currentStock,desc","stockLedgerDelta,asc","agedLotQty,desc"})
                assertThat(get(PATH+"?itemId="+item+"&sort="+sort,token).getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(item); }
    }
    @Test
    void permits_authenticated_read_roles_validates_inputs_and_has_no_writes() {
        assertThat(rest.getForEntity(PATH,String.class).getStatusCode().value()).isEqualTo(401);
        String token=loginAdmin();
        for (String role:new String[]{"SALES","MATERIAL","PRODUCTION","QUALITY","ACCOUNTING"}) {
            String user="inv-"+role.toLowerCase(); createUser(user,"password123",role);
            assertThat(get(PATH,login(user,"password123")).getStatusCode().value()).isEqualTo(200);
        }
        for (String q:new String[]{"from=bad","from="+today+"&to="+today.minusDays(1),"to="+today.plusDays(1),
                "from="+today.minusDays(366)+"&to="+today,"ageDays=0","ageDays=3651","itemId=0","itemType=bad","risk=bad",
                "page=-1","size=101","sort=price,asc","sort=itemNo,bad","keyword="+"X".repeat(129)}) {
            var r=get(PATH+"?"+q,token); assertThat(r.getStatusCode().value()).as(q).isEqualTo(400);
            assertThat(r.getBody().path("code").asText()).isEqualTo("INVALID_INPUT");
            assertThat(r.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        }
        assertThat(get(PATH+"?itemId=9223372036854775807",token).getStatusCode().value()).isEqualTo(404);
        assertThat(post(PATH,token,body()).getStatusCode().value()).isEqualTo(405);
        var doc=rest.getForEntity("/v3/api-docs",com.fasterxml.jackson.databind.JsonNode.class).getBody();
        assertThat(doc.path("paths").path(PATH).has("get")).isTrue();
        assertThat(doc.path("paths").path(PATH).has("post")).isFalse();
        assertThat(doc.path("components").path("schemas").has("InventoryAnalysisResponse")).isTrue();
    }
    private void money(com.fasterxml.jackson.databind.JsonNode row,String key,String expected) {
        assertThat(row.path(key).decimalValue()).as(key).isEqualByComparingTo(expected);
    }
    private long item(String unit,int stock,int safety) {
        return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,stock,safety_stock) values(?,'재고_100%','제품',?,?,?) returning id",Long.class,key(),unit,stock,safety);
    }
    private void movement(long item,int qty,LocalDate date) {
        jdbc.update("insert into inventory_transactions(txn_no,item_id,warehouse,txn_type,qty,txn_date) values(?,?,'검사창고','실사',?,?)",key(),item,qty,date);
    }
    private void lot(long item,int qty,int days,LocalDate expiry,String status) {
        jdbc.update("insert into lots(lot_no,item_id,warehouse,qty,produced_at,expiry,status) values(?,?,'검사창고',?,?,?,?)",key(),item,qty,today.minusDays(days),expiry,status);
    }
    private String key() { return "IA-"+UUID.randomUUID().toString().replace("-","").substring(0,20); }
    private void cleanup(long item) {
        jdbc.update("delete from inventory_transactions where item_id=?",item);
        jdbc.update("delete from lots where item_id=?",item); jdbc.update("delete from items where id=?",item);
    }
}
