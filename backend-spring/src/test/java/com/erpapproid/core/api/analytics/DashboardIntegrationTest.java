package com.erpapproid.core.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

class DashboardIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/analytics/dashboard";
    @Autowired JdbcTemplate jdbc;
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));

    @Test
    void aggregates_real_receipts_shipments_backlog_and_due_cohort_without_duplicate_or_legacy_inference() {
        long item = item();
        try {
            LocalDate date = today.minusDays(2);
            long order = order(item, "생산중", date, 10, 1000);
            long completed = order(item, "출하완료", date, 10, 1000);
            shipment(item, order, 4, 400, date, true);
            shipment(item, completed, 10, 1000, date, true);
            order(item, "확정", today, 10, 1000); // Not yet overdue; current backlog only.
            order(item, "대기", date, 10, 1000);
            order(item, "취소", date, 10, 1000);
            long legacy = order(item, "출하완료", date, 10, 1000);
            shipment(item, legacy, 10, 1000, date, false);
            work(item, 8, 2, date, true);
            work(item, 1, 1, date, true); // Mean 20% and 50%, NOT quantity-weighted.
            work(item, 9, 1, date, false);
            work(item, 1, 0, today.minusDays(20), true); // Out of period.
            jdbc.update("insert into work_orders(work_order_no,item_id,qty,start_date,due_date,status) values(?,?,1,?,?,'지시')",
                    key(), item, date, date);
            var response = get(path(item, date, today), loginAdmin());
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            var data = response.getBody(); var k = data.path("kpis");
            number(k, "revenueKrw", "1400"); number(k, "productionValueKrw", "900"); number(k, "backlogKrw", "1600");
            assertThat(k.path("backlogOrders").asLong()).isEqualTo(2);
            number(k, "onTimeDeliveryPercent", "50"); number(k, "meanOrderDefectPercent", "35");
            assertThat(k.path("eligibleDeliveryOrders").asLong()).isEqualTo(2);
            assertThat(k.path("completedWorkOrders").asLong()).isEqualTo(2);
            assertThat(k.path("inventoryTurnover").isNull()).isTrue();
            assertThat(k.path("inventoryTurnoverReason").asText()).contains("원가");
            assertThat(data.path("coverage").path("undatedShipments").asLong()).isEqualTo(1);
            assertThat(data.path("coverage").path("undatedCompletedWorkOrders").asLong()).isEqualTo(1);
            assertThat(data.path("coverage").path("unknownDeliveryOrders").asLong()).isEqualTo(1);
            assertThat(data.path("alerts").path("lowStockItems").asLong()).isEqualTo(1);
            assertThat(data.path("alerts").path("overdueWorkOrders").asLong()).isEqualTo(1);
            assertThat(data.path("alerts").path("overdueSalesOrders").asLong()).isEqualTo(1);
            var trends = data.path("trends");
            BigDecimal revenue = BigDecimal.ZERO, production = BigDecimal.ZERO;
            for (var row : trends) { revenue = revenue.add(row.path("revenueKrw").decimalValue()); production = production.add(row.path("productionValueKrw").decimalValue()); }
            assertThat(revenue).isEqualByComparingTo("1400"); assertThat(production).isEqualByComparingTo("900");
        } finally { cleanup(item); }
    }

    @Test
    void empty_period_zero_fills_months_and_returns_null_rates_but_current_alerts() {
        long item = item();
        try {
            var response = get(path(item, today.minusMonths(2).withDayOfMonth(1), today.minusMonths(1)), loginAdmin());
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            var k = response.getBody().path("kpis"); number(k, "revenueKrw", "0"); number(k, "productionValueKrw", "0");
            assertThat(k.path("onTimeDeliveryPercent").isNull()).isTrue();
            assertThat(k.path("meanOrderDefectPercent").isNull()).isTrue();
            assertThat(response.getBody().path("trends")).hasSize(2);
            assertThat(response.getBody().path("alerts").path("lowStockItems").asLong()).isEqualTo(1);
            var defaults = get(PATH + "?itemId=" + item, loginAdmin()).getBody();
            assertThat(defaults.path("metadata").path("from").asText()).isEqualTo(today.withDayOfMonth(1).toString());
            assertThat(defaults.path("metadata").path("to").asText()).isEqualTo(today.toString());
            assertThat(defaults.path("metadata").path("timeZone").asText()).isEqualTo("Asia/Seoul");
        } finally { cleanup(item); }
    }

    @Test
    void validates_ranges_ids_and_date_formats_with_traceable_errors() {
        for (String query : new String[] { "from=" + today + "&to=" + today.minusDays(1), "to=" + today.plusDays(1),
                "from=" + today.minusDays(366), "itemId=0", "itemId=-1", "from=not-a-date", "itemId=abc" }) {
            var r = get(PATH + "?" + query, loginAdmin());
            assertThat(r.getStatusCode().value()).isEqualTo(400);
            assertThat(r.getBody().path("code").asText()).isEqualTo("INVALID_INPUT");
            assertThat(r.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        }
        assertThat(get(PATH + "?itemId=9223372036854775807", loginAdmin()).getStatusCode().value()).isEqualTo(404);
        assertThat(get(PATH + "?from=" + today.minusDays(365), loginAdmin()).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void requires_jwt_all_authenticated_roles_read_without_business_writes_and_exposes_openapi() throws Exception {
        assertThat(rest.getForEntity(PATH, JsonNode.class).getStatusCode().value()).isEqualTo(401);
        createUser("dashboard-quality", "password123", "QUALITY");
        long before = jdbc.queryForObject("select count(*) from audit_logs", Long.class);
        var r = get(PATH, login("dashboard-quality", "password123"));
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(jdbc.queryForObject("select count(*) from audit_logs", Long.class)).isEqualTo(before);
        assertThat(rest.exchange(PATH, HttpMethod.POST, authEntity(loginAdmin(), body()), JsonNode.class).getStatusCode().value()).isEqualTo(405);
        var tx = DashboardService.class.getMethod("read", LocalDate.class, LocalDate.class, Long.class).getAnnotation(Transactional.class);
        assertThat(tx.readOnly()).isTrue(); assertThat(tx.isolation()).isEqualTo(Isolation.REPEATABLE_READ);
        var schema = rest.getForEntity("/v3/api-docs", JsonNode.class).getBody();
        assertThat(schema.path("paths").path(PATH).path("get").isMissingNode()).isFalse();
        assertThat(schema.path("components").path("schemas").path("DashboardResponse").isMissingNode()).isFalse();
    }

    @Test
    void alerts_have_total_counts_and_deterministic_bounded_rows() {
        long item = item();
        try {
            for (int i = 0; i < 21; i++) jdbc.update("insert into work_orders(work_order_no,item_id,qty,start_date,due_date,status) values(?,?,1,?,?,'지시')",
                    key(), item, today.minusDays(1), today.minusDays(1));
            var alerts = get(PATH + "?itemId=" + item, loginAdmin()).getBody().path("alerts");
            assertThat(alerts.path("rows")).hasSize(20);
            assertThat(alerts.path("total").asLong()).isEqualTo(22);
            assertThat(alerts.path("truncated").asBoolean()).isTrue();
        } finally { cleanup(item); }
    }

    private long item() { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock) values(?,'집계 테스트','제품','EA',100,0,5) returning id", Long.class, key()); }
    private long order(long item, String status, LocalDate due, int qty, int amount) {
        return jdbc.queryForObject("insert into sales_orders(sales_order_no,customer_id,item_id,qty,unit_price,amount,due_date,status,ordered_at) values(?,1,?,?,100,?,?,?,?) returning id", Long.class,
                key(), item, qty, amount, due, status, today.minusDays(30));
    }
    private void shipment(long item, long order, int qty, int amount, LocalDate date, boolean linked) {
        Long txn = linked ? movement(item, "SHIPMENT", key(), date, -qty) : null;
        Long receivable = linked ? jdbc.queryForObject("insert into receivables(receivable_no,customer_id,sales_order_id,amount,due_date) values(?,1,?,?,?) returning id", Long.class, key(), order, amount, date) : null;
        jdbc.update("insert into shipments(shipment_no,sales_order_id,customer_id,item_id,qty,amount,delivery_date,status,confirmed_date,inventory_txn_id,receivable_id) values(?,?,1,?,?,?,?,'출하완료',?,?,?)",
                key(), order, item, qty, amount, date, linked ? date : null, txn, receivable);
    }
    private void work(long item, int good, int defect, LocalDate date, boolean dated) {
        String no = key();
        jdbc.update("insert into work_orders(work_order_no,item_id,qty,good_qty,defect_qty,progress,start_date,due_date,status) values(?,?,?,?,?,100,?,?,'마감')", no, item, good + defect, good, defect, date, date);
        if (dated) { movement(item, "WORK_ORDER", no, date, good); movement(item, "WORK_ORDER", no, date, good); }
    }
    private Long movement(long item, String type, String ref, LocalDate date, int qty) {
        return jdbc.queryForObject("insert into inventory_transactions(txn_no,item_id,warehouse,txn_type,qty,ref_type,ref_no,txn_date) values(?,?,'완제품창고',?,?,?,?,?) returning id", Long.class, key(), item,
                type.equals("WORK_ORDER") ? "생산입고" : "출하", qty, type, ref, date);
    }
    private String key() { return "ANL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20); }
    private String path(long item, LocalDate from, LocalDate to) { return PATH + "?itemId=" + item + "&from=" + from + "&to=" + to; }
    private void number(JsonNode n, String key, String value) { assertThat(n.path(key).decimalValue()).isEqualByComparingTo(value); }
    private void cleanup(long item) {
        jdbc.update("delete from shipments where item_id=?", item);
        jdbc.update("delete from receivables where sales_order_id in (select id from sales_orders where item_id=?)", item);
        jdbc.update("delete from inventory_transactions where item_id=?", item);
        jdbc.update("delete from work_orders where item_id=?", item);
        jdbc.update("delete from sales_orders where item_id=?", item);
        jdbc.update("delete from items where id=?", item);
    }
}
