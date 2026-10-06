package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

class ReceivableListIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/receivables";
    @Autowired JdbcTemplate jdbc;

    @Test
    void reads_literal_filters_nullable_orders_and_stable_pages_without_mutating_stored_days() {
        var today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        long customer = customer();
        try {
            long past = ar(customer, 100, today.minusDays(3), "미수");
            ar(customer, 200, today, "미수");
            ar(customer, 300, today.plusDays(1), "연체");
            ar(customer, 400, today.minusDays(10), "수납완료");
            long audit = jdbc.queryForObject("select count(*) from audit_logs", Long.class);
            String query = PATH + "?customerId=" + customer;
            var uri = URI.create(rest.getRootUri() + query + "&keyword="
                    + URLEncoder.encode("고객_100%", StandardCharsets.UTF_8));
            var all = rest.exchange(uri, HttpMethod.GET, authEntity(loginAdmin(), null), JsonNode.class).getBody();
            assertThat(all.path("totalElements").asLong()).isEqualTo(4);
            for (var row : all.path("content")) {
                assertThat(row.path("salesOrderId").isNull()).isTrue();
                assertThat(row.path("salesOrderNo").isNull()).isTrue();
                assertThat(row.path("referenceDate").asText()).isEqualTo(today.toString());
                assertThat(row.path("overdueDays").asInt()).isEqualTo(row.path("id").asLong() == past ? 3 : 0);
            }
            var overdue = get(query + "&overdue=true", loginAdmin()).getBody();
            assertThat(overdue.path("content")).hasSize(1);
            assertThat(overdue.path("content").get(0).path("id").asLong()).isEqualTo(past);
            assertThat(get(query + "&overdue=false", loginAdmin()).getBody().path("totalElements").asInt()).isEqualTo(3);
            assertThat(get(query + "&status=미수&overdue=true", loginAdmin()).getBody().path("totalElements").asInt()).isEqualTo(1);
            assertThat(get(query + "&keyword=absent", loginAdmin()).getBody().path("content")).isEmpty();
            var first = get(query + "&size=1&sort=amount,asc", loginAdmin()).getBody();
            var second = get(query + "&size=1&sort=amount,asc&page=1", loginAdmin()).getBody();
            assertThat(first.path("totalPages").asInt()).isEqualTo(4);
            assertThat(first.path("content").get(0).path("amount").asInt()).isEqualTo(100);
            assertThat(second.path("content").get(0).path("amount").asInt()).isEqualTo(200);
            assertThat(get(query + "&page=10000", loginAdmin()).getBody().path("content")).isEmpty();
            assertThat(jdbc.queryForObject("select overdue_days from receivables where id=?", Integer.class, past)).isEqualTo(999);
            assertThat(jdbc.queryForObject("select count(*) from audit_logs", Long.class)).isEqualTo(audit);
        } finally { cleanup(customer); }
    }

    @Test
    void searches_real_order_reference_and_keeps_id_tie_breaker_stable() {
        var today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        long customer = customer();
        long item = jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price) values(?,'미수 테스트 제품','제품','EA',100) returning id", Long.class, key());
        try {
            String orderNo = key();
            long order = jdbc.queryForObject("insert into sales_orders(sales_order_no,customer_id,item_id,qty,unit_price,amount,due_date,status,ordered_at) values(?,?,?,1,100,100,?,'대기',?) returning id", Long.class, orderNo, customer, item, today, today);
            long first = ar(customer, 100, today, "미수");
            long second = ar(customer, 100, today, "미수");
            jdbc.update("update receivables set sales_order_id=? where id=?", order, first);
            String query = PATH + "?customerId=" + customer;
            var linked = get(query + "&keyword=" + orderNo.toLowerCase(), loginAdmin()).getBody().path("content");
            assertThat(linked).hasSize(1);
            assertThat(linked.get(0).path("salesOrderId").asLong()).isEqualTo(order);
            assertThat(linked.get(0).path("salesOrderNo").asText()).isEqualTo(orderNo);
            assertThat(get(query + "&size=1&sort=amount,desc", loginAdmin()).getBody().path("content").get(0).path("id").asLong()).isEqualTo(first);
            assertThat(get(query + "&size=1&sort=amount,desc&page=1", loginAdmin()).getBody().path("content").get(0).path("id").asLong()).isEqualTo(second);
        } finally {
            jdbc.update("delete from receivables where customer_id=?", customer);
            jdbc.update("delete from sales_orders where item_id=?", item);
            jdbc.update("delete from items where id=?", item);
            jdbc.update("delete from partners where id=?", customer);
        }
    }

    @Test
    void summarizes_global_open_principal_and_date_derived_overdue_at_korean_reference_date() {
        String token = loginAdmin();
        var before = get(PATH + "/summary", token).getBody();
        var today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        long customer = customer();
        try {
            ar(customer, 100, today.minusDays(3), "미수");
            ar(customer, 200, today, "미수");
            ar(customer, 300, today.plusDays(1), "연체");
            ar(customer, 400, today.minusDays(10), "수납완료");
            var after = get(PATH + "/summary", token).getBody();
            assertThat(after.path("openCount").asLong()).isEqualTo(before.path("openCount").asLong() + 3);
            assertThat(after.path("openAmount").asLong()).isEqualTo(before.path("openAmount").asLong() + 600);
            assertThat(after.path("overdueCount").asLong()).isEqualTo(before.path("overdueCount").asLong() + 1);
            assertThat(after.path("overdueAmount").asLong()).isEqualTo(before.path("overdueAmount").asLong() + 100);
            assertThat(after.path("referenceDate").asText()).isEqualTo(today.toString());
        } finally { cleanup(customer); }
    }

    @Test
    void validates_read_contract_and_roles_and_exports_actual_openapi() throws Exception {
        assertThat(rest.getForEntity(PATH, JsonNode.class).getStatusCode().value()).isEqualTo(401);
        for (String role : new String[]{"SALES", "ACCOUNTING", "MATERIAL", "PRODUCTION", "QUALITY"}) {
            String name = "ar-list-" + role.toLowerCase();
            createUser(name, "password123", role);
            String token = login(name, "password123");
            for (String path : new String[]{PATH, PATH + "/summary"}) {
                assertThat(get(path, token).getStatusCode().value()).isEqualTo(
                        role.equals("SALES") || role.equals("ACCOUNTING") ? 200 : 403);
            }
        }
        String token = loginAdmin();
        for (String query : new String[]{"page=-1", "page=10001", "size=0", "size=101", "customerId=0",
                "customerId=-1", "status=미납", "overdue=invalid", "sort=customer.name,asc", "sort=amount,bad", "keyword=" + "X".repeat(129)}) {
            var response = get(PATH + "?" + query, token);
            assertThat(response.getStatusCode().value()).as(query).isEqualTo(400);
            assertThat(response.getBody().path("code").asText()).isEqualTo("INVALID_INPUT");
            assertThat(response.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        }
        assertThat(get(PATH + "?customerId=9223372036854775807", token).getBody().path("content")).isEmpty();
        var doc = rest.getForEntity("/v3/api-docs", JsonNode.class).getBody();
        assertThat(doc.path("components").path("schemas").path("ReceivableResponse").path("properties").has("referenceDate")).isTrue();
        assertThat(doc.path("paths").path(PATH).path("get").path("parameters").toString()).contains("keyword", "overdue");
        var path = Path.of("build/openapi-receivables.json");
        Files.createDirectories(path.getParent());
        Files.writeString(path, doc.toString());
    }

    private long customer() {
        return jdbc.queryForObject("insert into partners(partner_no,name,partner_type) values(?,'고객_100%','고객사') returning id", Long.class, key());
    }
    private long ar(long customer, int amount, LocalDate due, String status) {
        return jdbc.queryForObject("insert into receivables(receivable_no,customer_id,amount,due_date,status,overdue_days,collected_amount,opening_collected_amount) values(?,?,?,?,?,999,?,?) returning id", Long.class, key(), customer, amount, due, status, status.equals("수납완료") ? amount : 0, status.equals("수납완료") ? amount : 0);
    }
    private String key() { return "AR-T-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20); }
    private void cleanup(long customer) {
        jdbc.update("delete from receivables where customer_id=?", customer);
        jdbc.update("delete from partners where id=?", customer);
    }
}
