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

class ProductionProgressIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/analytics/production/progress";
    @Autowired JdbcTemplate jdbc;
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
    @Test
    void recomputes_actual_progress_yield_and_remaining_without_mixed_unit_totals_or_stock_writes() {
        long item = item("kg"); String token = loginAdmin();
        try {
            work(item, 10, 4, 1, "진행중", today.minusDays(1), "");
            work(item, 10, 2, 0, "지시", today, "생산 담당");
            work(item, 10, 9, 1, "완료", today.minusDays(1), "");
            work(item, 10, 0, 0, "취소", today.minusDays(1), "");
            work(item, 10, 0, 0, "지시", today.plusDays(31), "");
            long audit = jdbc.queryForObject("select count(*) from audit_logs", Long.class);
            var response = get(PATH + "?itemId=" + item + "&status=all&size=1", token);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            var d = response.getBody(); var s = d.path("summary");
            assertThat(d.path("totalElements").asLong()).isEqualTo(4);
            assertThat(d.path("rows")).hasSize(1);
            assertThat(s.path("activeOrders").asLong()).isEqualTo(2);
            assertThat(s.path("completedOrders").asLong()).isEqualTo(1);
            assertThat(s.path("cancelledOrders").asLong()).isEqualTo(1);
            assertThat(s.path("delayedOrders").asLong()).isEqualTo(1);
            assertThat(s.path("unassignedActiveOrders").asLong()).isEqualTo(1);
            assertThat(s.path("meanActiveProgressPercent").decimalValue()).isEqualByComparingTo("35");
            assertThat(s.path("meanReportedYieldPercent").decimalValue()).isEqualByComparingTo("90");
            var active = get(PATH + "?itemId=" + item + "&sort=progressPercent,desc", token).getBody();
            var row = active.path("rows").get(0);
            assertThat(row.path("progressPercent").decimalValue()).isEqualByComparingTo("50");
            assertThat(row.path("yieldPercent").decimalValue()).isEqualByComparingTo("80");
            assertThat(row.path("remainingQty").decimalValue()).isEqualByComparingTo("5");
            assertThat(row.path("unit").asText()).isEqualTo("kg");
            assertThat(row.path("delayed").asBoolean()).isTrue();
            assertThat(jdbc.queryForObject("select stock from items where id=?", BigDecimal.class, item)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from audit_logs", Long.class)).isEqualTo(audit);
        } finally { cleanup(item); }
    }
    @Test
    void filters_literal_keyword_pages_and_keeps_legacy_over_actuals_explicit_and_out_of_rates() {
        long item = item("EA"); String token = loginAdmin();
        try {
            work(item, 10, 0, 0, "지시", today, "현장_100%");
            // Existing seed over-quantity closed work is preserved by V13; select it without rewriting history.
            var legacy = jdbc.queryForMap("select id,item_id,work_order_no,due_date from work_orders where good_qty+defect_qty>qty order by id limit 1");
            var old = get(PATH + "?status=all&keyword=" + legacy.get("work_order_no") + "&from=" + legacy.get("due_date") + "&to=" + legacy.get("due_date"), token).getBody();
            assertThat(old.path("rows").get(0).path("overActual").asBoolean()).isTrue();
            assertThat(old.path("rows").get(0).path("progressPercent").isNull()).isTrue();
            assertThat(old.path("summary").path("meanReportedYieldPercent").isNull()).isTrue();
            // URI overload preserves a once-encoded literal query (String overload encodes '%' again).
            var uri = java.net.URI.create(rest.getRootUri() + PATH + "?itemId=" + item + "&keyword="
                    + java.net.URLEncoder.encode("현장_100%", java.nio.charset.StandardCharsets.UTF_8));
            var escaped = rest.exchange(uri, org.springframework.http.HttpMethod.GET,
                    authEntity(token, null), com.fasterxml.jackson.databind.JsonNode.class).getBody();
            assertThat(escaped.path("rows")).hasSize(1);
            assertThat(escaped.path("summary").path("meanActiveProgressPercent").asInt()).isZero();
            assertThat(escaped.path("summary").path("meanReportedYieldPercent").isNull()).isTrue();
            assertThat(get(PATH + "?itemId=" + item + "&page=10000", token).getBody().path("rows")).isEmpty();
        } finally { cleanup(item); }
    }
    @Test
    void enforces_auth_validates_inputs_and_exposes_read_only_openapi() {
        assertThat(rest.getForEntity(PATH, String.class).getStatusCode().value()).isEqualTo(401);
        createUser("analysis-material", "password123", "MATERIAL"); String token = login("analysis-material", "password123");
        assertThat(get(PATH, token).getStatusCode().value()).isEqualTo(200);
        for (String q : new String[]{"from=bad", "from=" + today + "&to=" + today.minusDays(1), "from=" + today + "&to=" + today.plusDays(366),
                "page=-1", "size=101", "itemId=0", "status=bad", "sort=dueDate;drop,asc", "sort=dueDate,bad", "keyword=" + "X".repeat(129)}) {
            var r = get(PATH + "?" + q, token);
            assertThat(r.getStatusCode().value()).isEqualTo(400);
            assertThat(r.getBody().path("code").asText()).isEqualTo("INVALID_INPUT");
            assertThat(r.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        }
        assertThat(get(PATH + "?itemId=9223372036854775807", token).getStatusCode().value()).isEqualTo(404);
        assertThat(post(PATH, token, body()).getStatusCode().value()).isEqualTo(405);
        var doc = rest.getForEntity("/v3/api-docs", com.fasterxml.jackson.databind.JsonNode.class).getBody();
        assertThat(doc.path("paths").path(PATH).has("post")).isFalse();
        assertThat(doc.path("components").path("schemas").has("ProductionProgressResponse")).isTrue();
    }
    private long item(String unit) { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price) values(?,'분석 품목','제품',?,100) returning id", Long.class, key(), unit); }
    private void work(long item, int qty, int good, int defect, String status, LocalDate due, String assignee) {
        jdbc.update("insert into work_orders(work_order_no,item_id,qty,good_qty,defect_qty,progress,start_date,due_date,status,assignee) values(?,?,?,?,?,0,?,?,?,?)", key(), item, qty, good, defect, today.minusDays(3), due, status, assignee);
    }
    private String key() { return "PA-" + UUID.randomUUID().toString().replace("-", "").substring(0,20); }
    private void cleanup(long item) { jdbc.update("delete from work_orders where item_id=?", item); jdbc.update("delete from items where id=?", item); }
}
