package com.erpapproid.core.api.routing;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class RoutingIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void crud_partial_updates_keep_identity_and_record_audit() {
        String token = loginAdmin();
        var created = post("/api/core/routings", token, valid("T-RT-CRUD", 4, 90), "routing-create");
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            var updated = patch(id, token, body("isSubcontract", false, "stdTime", 0.123), "routing-update");
            assertThat(updated.getStatusCode().value()).isEqualTo(200);
            assertThat(updated.getBody().path("itemId").asLong()).isEqualTo(4);
            assertThat(updated.getBody().path("routingNo").asText()).isEqualTo("T-RT-CRUD");
            assertThat(updated.getBody().path("seq").asInt()).isEqualTo(90);
            assertThat(updated.getBody().path("process").asText()).isEqualTo("외주 도장");
            assertThat(updated.getBody().path("isSubcontract").asBoolean()).isFalse();
            assertThat(rest.exchange("/api/core/routings/" + id, HttpMethod.DELETE,
                    authEntity(token, null, "routing-delete"), JsonNode.class).getStatusCode().value()).isEqualTo(204);
            for (String trace : new String[]{"routing-create", "routing-update", "routing-delete"}) {
                assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc(trace)).singleElement().satisfies(a -> {
                    assertThat(a.getActorId()).isNotNull();
                    assertThat(a.getEntityType()).isEqualTo("ROUTING");
                    if (trace.equals("routing-create")) assertThat(a.getBeforeJson()).isNull();
                    else assertThat(a.getBeforeJson()).isNotNull();
                    if (trace.equals("routing-delete")) assertThat(a.getAfterJson()).isNull();
                    else assertThat(a.getAfterJson()).isNotNull();
                });
            }
        } finally { jdbc.update("delete from routings where id = ?", id); }
    }

    @Test
    void validates_create_patch_duplicate_code_and_sequence() {
        String token = loginAdmin();
        error(post("/api/core/routings", token, valid("RT-001", 4, 90)), 409, "ROUTING_NO_DUPLICATE");
        error(post("/api/core/routings", token, valid("T-RT-DUP", 1, 10)), 409, "ROUTING_SEQ_DUPLICATE");
        error(patch(1, token, body("seq", 20), "rt-duplicate"), 409, "ROUTING_SEQ_DUPLICATE");
        for (Map<String, Object> invalid : java.util.List.of(body("seq", 0), body("stdTime", -1),
                body("stdTime", 0.0001), body("routingNo", "x".repeat(33)),
                body("process", " "), body("workCenter", "x".repeat(33)))) {
            var request = valid("T-RT-INVALID", 4, 90);
            request.putAll(invalid);
            error(post("/api/core/routings", token, request), 400, "INVALID_INPUT");
        }
        error(patch(1, token, body(), "rt-empty"), 400, "INVALID_INPUT");
        error(patch(1, token, body("process", " "), "rt-blank"), 400, "INVALID_INPUT");
        error(patch(999999, token, body("seq", 90), "rt-missing"), 404, "ROUTING_NOT_FOUND");
        error(post("/api/core/routings", token, valid("T-RT-MATERIAL", 6, 90)), 422, "ITEM_NOT_PRODUCIBLE");
    }

    @Test
    void production_writes_viewer_reads_only_admin_deletes() {
        createUser("routing-production", "password123", "PRODUCTION");
        createUser("routing-viewer", "password123", "MATERIAL");
        String production = login("routing-production", "password123");
        String viewer = login("routing-viewer", "password123");
        var created = post("/api/core/routings", production, valid("T-RT-ROLE", 4, 90));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            assertThat(patch(id, production, body("seq", 91), "routing-role").getStatusCode().value()).isEqualTo(200);
            error(rest.exchange("/api/core/routings/" + id, HttpMethod.DELETE,
                    authEntity(production, null), JsonNode.class), 403, "FORBIDDEN");
            assertThat(get("/api/core/routings", viewer).getStatusCode().value()).isEqualTo(200);
            error(post("/api/core/routings", viewer, valid("T-RT-DENIED", 4, 90)), 403, "FORBIDDEN");
            error(patch(id, viewer, body("seq", 92), "routing-denied"), 403, "FORBIDDEN");
            error(rest.exchange("/api/core/routings/" + id, HttpMethod.DELETE,
                    authEntity(viewer, null), JsonNode.class), 403, "FORBIDDEN");
        } finally { jdbc.update("delete from routings where id = ?", id); }
    }

    @Test
    void list_filters_searches_sorts_and_paginates() {
        String token = loginAdmin();
        var list = get("/api/core/routings?itemId=1&size=2&sort=seq,desc", token);
        assertThat(list.getStatusCode().value()).isEqualTo(200);
        assertThat(list.getBody().path("totalElements").asInt()).isEqualTo(3);
        assertThat(list.getBody().path("content")).hasSize(2);
        assertThat(list.getBody().path("content").get(0).path("seq").asInt()).isEqualTo(30);
        assertThat(get("/api/core/routings?keyword=P-A001", token).getBody().path("totalElements").asInt()).isEqualTo(3);
        assertThat(get("/api/core/routings?keyword=%25", token).getBody().path("totalElements").asInt()).isZero();
        for (String q : new String[]{"size=101", "page=-1", "itemId=0", "sort=unknown,asc"}) {
            error(get("/api/core/routings?" + q, token), 400, "INVALID_INPUT");
        }
        error(get("/api/core/routings", null), 401, "UNAUTHORIZED");
    }

    @Test
    void standalone_work_order_captures_sorted_steps_and_keeps_them_after_master_changes() {
        String token = loginAdmin();
        var routing = post("/api/core/routings", token, valid("T-RT-SNAPSHOT", 4, 5));
        assertThat(routing.getStatusCode().value()).isEqualTo(201);
        long routingId = routing.getBody().path("id").asLong();
        long orderId = 0;
        try {
            var order = post("/api/core/work-orders", token, body("workOrderNo", "T-WO-SNAPSHOT", "itemId", 4,
                    "qty", 10, "dueDate", "2026-12-31"), "routing-work-order");
            assertThat(order.getStatusCode().value()).isEqualTo(201);
            orderId = order.getBody().path("id").asLong();
            assertThat(order.getBody().path("routingSteps")).hasSize(2);
            assertThat(order.getBody().path("routingSteps").get(0).path("routingId").asLong()).isEqualTo(routingId);
            assertThat(order.getBody().path("plannedTimeHours").decimalValue()).isEqualByComparingTo("6.5");
            assertThat(order.getBody().path("subcontractTimeHours").decimalValue()).isEqualByComparingTo("5");
            assertThat(patch(routingId, token, body("stdTime", 2, "isSubcontract", false), "rt-master-change")
                    .getStatusCode().value()).isEqualTo(200);
            var persisted = get("/api/core/work-orders/" + orderId, token);
            assertThat(persisted.getStatusCode().value()).isEqualTo(200);
            assertThat(persisted.getBody().path("routingSteps")).isEqualTo(order.getBody().path("routingSteps"));
            assertThat(persisted.getBody().path("plannedTimeHours").decimalValue()).isEqualByComparingTo("6.5");
            error(rest.exchange("/api/core/routings/" + routingId, HttpMethod.DELETE,
                    authEntity(token, null), JsonNode.class), 409, "ROUTING_IN_USE");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("routing-work-order")).singleElement()
                    .satisfies(a -> assertThat(a.getAfterJson()).contains("routingSteps", "T-RT-SNAPSHOT"));
        } finally {
            jdbc.update("delete from work_orders where id = ?", orderId);
            jdbc.update("delete from routings where id = ?", routingId);
        }
    }

    private Map<String, Object> valid(String code, long item, int seq) {
        return body("routingNo", code, "itemId", item, "seq", seq, "process", "외주 도장",
                "workCenter", "WC-TEST", "stdTime", 0.5, "isSubcontract", true);
    }
    private ResponseEntity<JsonNode> patch(long id, String token, Object request, String trace) {
        return rest.exchange("/api/core/routings/" + id, HttpMethod.PATCH, authEntity(token, request, trace), JsonNode.class);
    }
    private void error(ResponseEntity<JsonNode> response, int status, String code) {
        assertThat(response.getStatusCode().value()).isEqualTo(status);
        assertThat(response.getBody().path("code").asText()).isEqualTo(code);
    }
}
