package com.erpapproid.core.api.production;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class ProductionPlanIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/production-plans";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void create_lists_filter_and_updates_quantities() {
        String token = loginAdmin(); long item = item("T-PLAN-LIST");
        try {
            var created = post(PATH, token, plan("PL-T-LIST", item, "2026-11", 100));
            assertThat(created.getStatusCode().value()).isEqualTo(201);
            var monthResponse = get(PATH + "?planMonth=2026-11", token);
            assertThat(monthResponse.getStatusCode().value()).as("list status").isEqualTo(200);
            var monthOnly = monthResponse.getBody();
            long id = created.getBody().path("id").asLong();
            assertThat(created.getBody().path("status").asText()).isEqualTo("계획");
            assertThat(created.getBody().path("orderQty").asText()).isEqualTo("0");
            assertThat(monthOnly.path("totalElements").asLong()).as("month filter").isGreaterThanOrEqualTo(1);
            var listed = get(PATH + "?planMonth=2026-11&status=계획", token).getBody();
            assertThat(listed.path("totalElements").asLong()).isGreaterThanOrEqualTo(1);
            assertThat(get(PATH + "?planMonth=2026-12", token).getBody().path("totalElements").asLong()).isZero();
            var updated = rest.exchange(PATH + "/" + id, org.springframework.http.HttpMethod.PATCH,
                    authEntity(token, body("planNo", "PL-T-LIST", "itemId", item, "planMonth", "2026-11",
                            "planQty", 100, "orderQty", 40, "stockQty", 10, "gapQty", 50)), JsonNode.class);
            assertThat(updated.getStatusCode().value()).isEqualTo(200);
            assertThat(updated.getBody().path("gapQty").asText()).isEqualTo("50");
            assertThat(updated.getBody().path("planNo").asText()).isEqualTo("PL-T-LIST");
        } finally { cleanup(item); }
    }

    @Test
    void rejects_invalid_duplicate_and_missing_references() {
        String token = loginAdmin(); long item = item("T-PLAN-DUP");
        try {
            assertThat(post(PATH, token, plan("PL-T-DUP", item, "2026-11", 100)).getStatusCode().value()).isEqualTo(201);
            error(post(PATH, token, plan("PL-T-DUP2", item, "2026-11", 50)), 409, "PLAN_DUPLICATE");
            error(post(PATH, token, plan("PL-T-DUP3", 999999L, "2026-11", 50)), 404, "ITEM_NOT_FOUND");
            for (var invalid : List.of(body("planNo", ""), body("itemId", 0), body("planMonth", ""), body("planQty", 0), body("planQty", -5))) {
                var request = plan("PL-T-DUPX", item, "2026-11", 50); request.putAll(invalid);
                error(post(PATH, token, request), 400, "INVALID_INPUT");
            }
            error(rest.exchange(PATH + "/999999", org.springframework.http.HttpMethod.PATCH,
                    authEntity(token, plan("PL-T-DUPX", item, "2026-11", 50)), JsonNode.class), 404, "NOT_FOUND");
        } finally { cleanup(item); }
    }

    @Test
    void confirm_close_transitions_and_illegal_moves() {
        String token = loginAdmin(); long item = item("T-PLAN-FLOW");
        try {
            long id = post(PATH, token, plan("PL-T-FLOW", item, "2026-11", 100), "plan-flow-create").getBody().path("id").asLong();
            error(post(PATH + "/" + id + "/close", token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(post(PATH + "/" + id + "/confirm", token, body(), "plan-flow-confirm").getBody().path("status").asText()).isEqualTo("확정");
            error(post(PATH + "/" + id + "/confirm", token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(post(PATH + "/" + id + "/close", token, body(), "plan-flow-close").getBody().path("status").asText()).isEqualTo("종결");
            error(post(PATH + "/" + id + "/close", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(post(PATH + "/999999/confirm", token, body()), 404, "NOT_FOUND");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("plan-flow-create")).hasSize(1);
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("plan-flow-confirm")).hasSize(1);
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("plan-flow-close")).hasSize(1);
        } finally { cleanup(item); }
    }

    @Test
    void enforces_authentication_and_production_role() {
        String token = loginAdmin(); long item = item("T-PLAN-ROLE");
        try {
            createUser("plan-production", "plan123", "PRODUCTION");
            createUser("plan-sales", "plan123", "SALES");
            String production = login("plan-production", "plan123");
            String sales = login("plan-sales", "plan123");
                assertThat(post(PATH, production, plan("PL-T-ROLE", item, "2026-11", 10)).getStatusCode().value()).isEqualTo(201);
                error(post(PATH, sales, plan("PL-T-ROLE2", item, "2026-11", 10)), 403, "FORBIDDEN");
                error(post(PATH, plan("PL-T-ROLE3", item, "2026-11", 10)), 401, "UNAUTHORIZED");
                error(rest.exchange(PATH + "/1/confirm", org.springframework.http.HttpMethod.POST, authEntity(sales, body()), JsonNode.class), 403, "FORBIDDEN");
        } finally { cleanup(item); }
    }

    private long item(String no) { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'계획 검증 제품','제품','EA',1000,5,0,0) returning id", Long.class, no); }
    private java.util.Map<String, Object> plan(String no, long item, String month, double qty) { return body("planNo", no, "itemId", item, "planMonth", month, "planQty", qty); }
    private void error(ResponseEntity<JsonNode> r, int status, String code) { assertThat(r.getStatusCode().value()).isEqualTo(status); assertThat(r.getBody().path("code").asText()).isEqualTo(code); }
    private void cleanup(long item) {
        jdbc.update("delete from production_plans where item_id = ?", item); jdbc.update("delete from items where id = ?", item);
    }
}
