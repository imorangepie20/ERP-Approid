package com.erpapproid.core.api.production;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class ProductionPlanSuggestIntegrationTest extends IntegrationTestSupport {
    private static final String SUGGEST = "/api/core/production-plans/suggest";
    private static final String PATH = "/api/core/production-plans";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void suggests_net_requirement_from_open_backlog_and_stock_with_evidence() {
        String token = loginAdmin();
        long item = jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'산출 검증 제품','제품','EA',1000,60,20,0) returning id", Long.class, key("T-SUG-ITEM-"));
        try {
            order(item, "A", "확정", 100, LocalDate.of(2026, 11, 10));
            long b = order(item, "B", "생산중", 50, LocalDate.of(2026, 11, 20));
            ship(item, b, 30);
            order(item, "C", "확정", 999, LocalDate.of(2026, 12, 5));
            order(item, "D", "취소", 999, LocalDate.of(2026, 11, 5));
            order(item, "E", "대기", 999, LocalDate.of(2026, 11, 5));
            order(item, "F", "출하완료", 999, LocalDate.of(2026, 11, 5));
            long g = order(item, "G", "확정", 10, LocalDate.of(2026, 11, 1));
            ship(item, g, 10);
            var body = get(SUGGEST + "?itemId=" + item + "&planMonth=2026-11", token).getBody();
            assertThat(body.path("orderBacklogQty").asDouble()).isEqualTo(120.0);
            assertThat(body.path("currentStock").asDouble()).isEqualTo(60.0);
            assertThat(body.path("safetyStock").asDouble()).isEqualTo(20.0);
            assertThat(body.path("suggestedPlanQty").asDouble()).isEqualTo(80.0);
            assertThat(body.path("suggestedGapQty").asDouble()).isEqualTo(80.0);
            assertThat(body.path("dueCutoff").asText()).isEqualTo("2026-11-30");
            assertThat(body.path("openOrderCount").asInt()).isEqualTo(3);
            var orderNos = new java.util.ArrayList<String>();
            body.path("orders").forEach(o -> orderNos.add(o.path("salesOrderNo").asText()));
            assertThat(orderNos).hasSize(3);
            assertThat(String.join(",", orderNos)).contains("T-SUG-A").contains("T-SUG-B").contains("T-SUG-G");
            assertThat(String.join(",", orderNos)).doesNotContain("T-SUG-C").doesNotContain("T-SUG-D").doesNotContain("T-SUG-E").doesNotContain("T-SUG-F");
            assertThat(body.path("notes").size()).isGreaterThanOrEqualTo(1);
        } finally { cleanup(item); }
    }

    @Test
    void floors_suggestion_at_zero_and_rejects_bad_input() {
        String token = loginAdmin();
        long item = jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'산출 하한 제품','제품','EA',1000,500,10,0) returning id", Long.class, key("T-SUG-ZERO-"));
        try {
            var body = get(SUGGEST + "?itemId=" + item + "&planMonth=2026-11", token).getBody();
            assertThat(body.path("suggestedPlanQty").asDouble()).isZero();
            assertThat(body.path("openOrderCount").asInt()).isZero();
            error(get(SUGGEST + "?itemId=" + item + "&planMonth=2026-13", token), 400, "INVALID_INPUT");
            error(get(SUGGEST + "?itemId=" + item + "&planMonth=2026/11", token), 400, "INVALID_INPUT");
            error(get(SUGGEST + "?itemId=0&planMonth=2026-11", token), 400, "INVALID_INPUT");
            error(get(SUGGEST + "?itemId=999999999&planMonth=2026-11", token), 404, "ITEM_NOT_FOUND");
            error(get(SUGGEST + "?itemId=" + item + "&planMonth=2026-11", null), 401, "UNAUTHORIZED");
        } finally { cleanup(item); }
    }

    @Test
    void records_basis_note_in_create_audit_and_rejects_oversize_note() {
        String token = loginAdmin();
        long item = jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'근거 검증 제품','제품','EA',1000,60,20,0) returning id", Long.class, key("T-SUG-BASIS-"));
        try {
            var request = body("planNo", key("PL-SUG-"), "itemId", item, "planMonth", "2026-11", "planQty", 80,
                    "basisNote", "수주잔량 120 + 안전재고 20 - 현재고 60 = 80 (확정 2건·생산중 1건, 납기 2026-11-30 이전)");
            var created = post(PATH, token, request, "sug-basis-create");
            assertThat(created.getStatusCode().value()).isEqualTo(201);
            var logs = audits.findAllByTraceIdOrderByOccurredAtAsc("sug-basis-create");
            assertThat(logs).hasSize(1);
            assertThat(logs.get(0).getAfterJson()).contains("수주잔량 120");
            var oversize = body("planNo", key("PL-SUG-X-"), "itemId", item, "planMonth", "2026-11", "planQty", 80, "basisNote", "근거".repeat(600));
            error(post(PATH, token, oversize), 400, "INVALID_INPUT");
        } finally { cleanup(item); }
    }

    private long order(long item, String suffix, String status, int qty, LocalDate due) {
        return jdbc.queryForObject("insert into sales_orders(sales_order_no,customer_id,item_id,qty,unit_price,amount,due_date,status,ordered_at) values(?,1,?,?,100,?,?,?,?) returning id",
                Long.class, key("T-SUG-" + suffix + "-"), item, qty, qty * 100, due, status, LocalDate.of(2026, 10, 1));
    }

    private void ship(long item, long order, int qty) {
        jdbc.update("insert into shipments(shipment_no,sales_order_id,customer_id,item_id,qty,amount,delivery_date,status,confirmed_date,inventory_txn_id,receivable_id) values(?, ?,1,?,?,?,?,'출하완료',?,null,null)",
                key("T-SUG-SH-"), order, item, qty, qty * 100, LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2));
    }

    private String key(String prefix) { return prefix + UUID.randomUUID().toString().substring(0, 8); }
    private void error(ResponseEntity<JsonNode> r, int status, String code) { assertThat(r.getStatusCode().value()).isEqualTo(status); assertThat(r.getBody().path("code").asText()).isEqualTo(code); }
    private void cleanup(long item) {
        jdbc.update("delete from shipments where item_id = ?", item);
        jdbc.update("delete from sales_orders where item_id = ?", item);
        jdbc.update("delete from production_plans where item_id = ?", item);
        jdbc.update("delete from items where id = ?", item);
    }
}
