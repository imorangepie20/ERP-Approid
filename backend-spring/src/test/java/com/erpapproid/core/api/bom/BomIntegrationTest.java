package com.erpapproid.core.api.bom;

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

class BomIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void crud_partial_patch_and_analysis_feed_share_persisted_bom() {
        String token = loginAdmin();
        var created = post("/api/core/boms", token, valid("T-BOM-CRUD", 4, 8), "bom-create");
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            var patched = patch(id, token, body("qty", 2.3456, "substituteNo", ""), "bom-update");
            assertThat(patched.getStatusCode().value()).isEqualTo(200);
            assertThat(patched.getBody().path("bomNo").asText()).isEqualTo("T-BOM-CRUD");
            assertThat(patched.getBody().path("parentId").asLong()).isEqualTo(4);
            assertThat(patched.getBody().path("lossRate").asInt()).isEqualTo(5);
            assertThat(patched.getBody().path("substituteNo").asText()).isEmpty();
            var headers = new org.springframework.http.HttpHeaders();
            headers.set("X-Internal-Key", "erp-approid-test-internal-key-for-automated-tests");
            var feed = rest.exchange("/api/core/internal/boms", HttpMethod.GET,
                    new org.springframework.http.HttpEntity<>(headers), JsonNode.class);
            assertThat(feed.getStatusCode().value()).isEqualTo(200);
            assertThat(feed.getBody()).anySatisfy(row -> {
                assertThat(row.path("id").asLong()).isEqualTo(id);
                assertThat(row.path("qty").decimalValue()).isEqualByComparingTo("2.3456");
            });
            assertThat(rest.exchange("/api/core/boms/" + id, HttpMethod.DELETE,
                    authEntity(token, null, "bom-delete"), JsonNode.class).getStatusCode().value()).isEqualTo(204);
            for (String trace : new String[]{"bom-create", "bom-update", "bom-delete"}) {
                assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc(trace)).singleElement().satisfies(a -> {
                    assertThat(a.getActorId()).isNotNull();
                    assertThat(a.getEntityType()).isEqualTo("BOM");
                    if (trace.equals("bom-create")) assertThat(a.getBeforeJson()).isNull();
                    else assertThat(a.getBeforeJson()).isNotNull();
                    if (trace.equals("bom-delete")) assertThat(a.getAfterJson()).isNull();
                    else assertThat(a.getAfterJson()).isNotNull();
                });
            }
        } finally { jdbc.update("delete from boms where id = ?", id); }
    }

    @Test
    void rejects_self_multilevel_cycles_and_duplicate_edges_or_codes() {
        String token = loginAdmin();
        error(post("/api/core/boms", token, valid("T-BOM-SELF", 1, 1)), 409, "BOM_CYCLE");
        // Seed graph includes 1→5; add 5→4, then reject the closing 4→1 edge.
        var edge = post("/api/core/boms", token, valid("T-BOM-PATH", 5, 4));
        assertThat(edge.getStatusCode().value()).isEqualTo(201);
        try {
            error(post("/api/core/boms", token, valid("T-BOM-CYCLE", 4, 1)), 409, "BOM_CYCLE");
            error(post("/api/core/boms", token, valid("T-BOM-DUP", 1, 5)), 409, "BOM_DUPLICATE");
            error(post("/api/core/boms", token, valid("BOM-001", 4, 8)), 409, "BOM_DUPLICATE");
        } finally { jdbc.update("delete from boms where id = ?", edge.getBody().path("id").asLong()); }
    }

    @Test
    void validates_numbers_lengths_and_empty_patch() {
        String token = loginAdmin();
        for (Map<String, Object> invalid : java.util.List.of(body("qty", 0), body("qty", 0.00001),
                body("lossRate", -1), body("lossRate", 101), body("lossRate", 1.001),
                body("bomNo", "x".repeat(33)), body("substituteNo", "x".repeat(33)))) {
            var request = valid("T-BOM-INVALID", 4, 8);
            request.putAll(invalid);
            error(post("/api/core/boms", token, request), 400, "INVALID_INPUT");
        }
        error(patch(1, token, body(), "bom-empty"), 400, "INVALID_INPUT");
        error(patch(1, token, body("qty", -1), "bom-invalid"), 400, "INVALID_INPUT");
        error(patch(999999, token, body("qty", 1), "bom-missing"), 404, "BOM_NOT_FOUND");
    }

    @Test
    void production_writes_viewer_reads_and_admin_deletes() {
        createUser("bom-production", "password123", "PRODUCTION");
        createUser("bom-viewer", "password123", "SALES");
        String production = login("bom-production", "password123");
        String viewer = login("bom-viewer", "password123");
        var created = post("/api/core/boms", production, valid("T-BOM-ROLE", 4, 8));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            assertThat(patch(id, production, body("lossRate", 2), "bom-role").getStatusCode().value()).isEqualTo(200);
            error(rest.exchange("/api/core/boms/" + id, HttpMethod.DELETE,
                    authEntity(production, null), JsonNode.class), 403, "FORBIDDEN");
            assertThat(get("/api/core/boms", viewer).getStatusCode().value()).isEqualTo(200);
            error(post("/api/core/boms", viewer, valid("T-BOM-DENIED", 4, 8)), 403, "FORBIDDEN");
            error(patch(id, viewer, body("qty", 2), "bom-denied"), 403, "FORBIDDEN");
            error(rest.exchange("/api/core/boms/" + id, HttpMethod.DELETE,
                    authEntity(viewer, null), JsonNode.class), 403, "FORBIDDEN");
        } finally { jdbc.update("delete from boms where id = ?", id); }
    }

    @Test
    void list_search_parent_filter_pagination_sort_and_query_validation() {
        String token = loginAdmin();
        var list = get("/api/core/boms?parentId=1&size=1&sort=qty,desc", token);
        assertThat(list.getStatusCode().value()).isEqualTo(200);
        assertThat(list.getBody().path("content")).hasSize(1);
        assertThat(list.getBody().path("totalElements").asInt()).isEqualTo(2);
        assertThat(list.getBody().path("content").get(0).path("childName").asText()).isEqualTo("강판 3.0mm");
        assertThat(get("/api/core/boms?keyword=M-S001", token).getBody().path("totalElements").asInt()).isEqualTo(2);
        assertThat(get("/api/core/boms?keyword=%25", token).getBody().path("totalElements").asInt()).isZero();
        for (String query : new String[]{"page=-1", "size=101", "parentId=0", "sort=unknown,asc", "sort=qty,wrong"}) {
            error(get("/api/core/boms?" + query, token), 400, "INVALID_INPUT");
        }
        error(get("/api/core/boms", null), 401, "UNAUTHORIZED");
    }

    private Map<String, Object> valid(String code, long parent, long child) {
        return body("bomNo", code, "parentId", parent, "childId", child, "qty", 1, "lossRate", 5, "substituteNo", "ALT-01");
    }

    @Test
    void concurrent_opposite_edges_cannot_create_cycle() {
        String token = loginAdmin();
        var a = post("/api/core/items", token, body("itemNo", "T-BOM-RACE-A", "name", "Race A",
                "itemType", "반제품", "unit", "EA", "price", 0));
        var b = post("/api/core/items", token, body("itemNo", "T-BOM-RACE-B", "name", "Race B",
                "itemType", "반제품", "unit", "EA", "price", 0));
        assertThat(a.getStatusCode().value()).isEqualTo(201);
        assertThat(b.getStatusCode().value()).isEqualTo(201);
        long aId = a.getBody().path("id").asLong();
        long bId = b.getBody().path("id").asLong();
        try {
            var start = new java.util.concurrent.CountDownLatch(1);
            var first = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                await(start);
                return post("/api/core/boms", token, valid("T-BOM-RACE-AB", aId, bId));
            });
            var second = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                await(start);
                return post("/api/core/boms", token, valid("T-BOM-RACE-BA", bId, aId));
            });
            start.countDown();
            var results = java.util.List.of(first.join(), second.join());
            assertThat(results).extracting(r -> r.getStatusCode().value()).containsExactlyInAnyOrder(201, 409);
            results.stream().filter(r -> r.getStatusCode().value() == 409).forEach(r -> error(r, 409, "BOM_CYCLE"));
        } finally {
            jdbc.update("delete from boms where parent_id in (?, ?) or child_id in (?, ?)", aId, bId, aId, bId);
            jdbc.update("delete from items where id in (?, ?)", aId, bId);
        }
    }

    private void await(java.util.concurrent.CountDownLatch latch) {
        try { latch.await(); }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); }
    }
    private ResponseEntity<JsonNode> patch(long id, String token, Object request, String trace) {
        return rest.exchange("/api/core/boms/" + id, HttpMethod.PATCH, authEntity(token, request, trace), JsonNode.class);
    }
    private void error(ResponseEntity<JsonNode> response, int status, String code) {
        assertThat(response.getStatusCode().value()).isEqualTo(status);
        assertThat(response.getBody().path("code").asText()).isEqualTo(code);
    }
}
