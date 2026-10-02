package com.erpapproid.core.api.production;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class WorkOrderIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/work-orders";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void crud_partial_updates_assignment_identity_and_routing_snapshot_are_persistent() {
        String token = loginAdmin();
        var request = valid("T-WO-CRUD", 4); request.put("assignee", "생산 담당자"); request.put("priority", 2);
        var created = post(PATH, token, request, "wo-create");
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            var patched = patch(id, token, body("qty", 12, "assignee", "", "priority", 3), "wo-update");
            assertThat(patched.getStatusCode().value()).isEqualTo(200);
            assertThat(patched.getBody().path("workOrderNo").asText()).isEqualTo("T-WO-CRUD");
            assertThat(patched.getBody().path("itemId").asLong()).isEqualTo(4);
            assertThat(patched.getBody().path("assignee").asText()).isEmpty();
            assertThat(patched.getBody().path("priority").asInt()).isEqualTo(3);
            assertThat(patched.getBody().path("routingSteps")).isEqualTo(created.getBody().path("routingSteps"));
            assertThat(patched.getBody().path("plannedTimeHours").decimalValue()).isEqualByComparingTo("1.8");
            assertThat(delete(id, token, "wo-delete").getStatusCode().value()).isEqualTo(204);
            assertAudit("wo-create", false, true); assertAudit("wo-update", true, true); assertAudit("wo-delete", true, false);
        } finally { cleanup(id); }
    }

    @Test
    void cumulative_actuals_complete_close_create_lot_transaction_and_increase_stock_once() {
        String token = loginAdmin(); long itemId = item("T-WO-STOCK");
        long id = create("T-WO-STOCK", itemId, token);
        try {
            var progress = post(PATH + "/" + id + "/progress", token, body("goodQty", 4, "defectQty", 1), "wo-progress");
            assertThat(progress.getStatusCode().value()).isEqualTo(200);
            assertThat(progress.getBody().path("progress").decimalValue()).isEqualByComparingTo("50");
            assertThat(progress.getBody().path("status").asText()).isEqualTo("진행중");
            assertThat(stock(itemId)).isEqualByComparingTo("0");
            error(post(PATH + "/" + id + "/complete", token, body()), 422, "WORK_ORDER_QTY_MISMATCH");
            var done = post(PATH + "/" + id + "/complete", token, body("goodQty", 8, "defectQty", 2), "wo-complete");
            assertThat(done.getStatusCode().value()).isEqualTo(200);
            assertThat(done.getBody().path("workOrder").path("status").asText()).isEqualTo("완료");
            assertThat(stock(itemId)).isEqualByComparingTo("8");
            assertThat(jdbc.queryForObject("select sum(qty) from inventory_transactions where item_id = ?", BigDecimal.class, itemId))
                    .isEqualByComparingTo(stock(itemId));
            assertThat(jdbc.queryForObject("select qty from lots where lot_no = ?", BigDecimal.class, done.getBody().path("lotNo").asText()))
                    .isEqualByComparingTo("8");
            assertThat(jdbc.queryForObject("select warehouse from lots where lot_no = ?", String.class, done.getBody().path("lotNo").asText()))
                    .isEqualTo("완제품창고");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("wo-complete")).hasSize(4)
                    .allSatisfy(a -> { assertThat(a.getActorId()).isNotNull(); assertThat(a.getAfterJson()).isNotNull(); })
                    .extracting(a -> a.getEntityType()).containsExactlyInAnyOrder("WORK_ORDER", "LOT", "INVENTORY_TRANSACTION", "ITEM");
            error(post(PATH + "/" + id + "/complete", token, body("goodQty", 8)), 409, "INVALID_STATE_TRANSITION");
            error(post(PATH + "/" + id + "/progress", token, body("goodQty", 7)), 409, "INVALID_STATE_TRANSITION");
            assertThat(post(PATH + "/" + id + "/close", token, body(), "wo-close").getBody().path("status").asText()).isEqualTo("마감");
            error(post(PATH + "/" + id + "/close", token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(stock(itemId)).isEqualByComparingTo("8");
            assertAudit("wo-progress", true, true); assertAudit("wo-close", true, true);
        } finally { cleanup(id); cleanupItem(itemId); }
    }

    @Test
    void validates_numbers_precision_references_quantity_limits_and_terminal_states() {
        String token = loginAdmin();
        for (Map<String, Object> invalid : List.of(body("qty", 0), body("qty", 0.00001), body("workOrderNo", "x".repeat(33)),
                body("priority", 4), body("assignee", "x".repeat(65)), body("salesOrderId", 3))) {
            var request = valid("T-WO-INVALID", 4); request.putAll(invalid);
            error(post(PATH, token, request), 400, "INVALID_INPUT");
        }
        error(post(PATH, token, valid("WO-2610-001", 4)), 409, "WORK_ORDER_NO_DUPLICATE");
        error(post(PATH, token, valid("T-WO-MATERIAL", 6)), 422, "ITEM_NOT_PRODUCIBLE");
        long id = create("T-WO-ACTUALS", 4, token);
        try {
            error(patch(id, token, body(), "wo-empty-patch"), 400, "INVALID_INPUT");
            error(post(PATH + "/" + id + "/progress", token, body()), 400, "INVALID_INPUT");
            for (var request : List.of(body("goodQty", -1), body("defectQty", 0.00001))) {
                error(post(PATH + "/" + id + "/progress", token, request), 400, "INVALID_INPUT");
            }
            error(post(PATH + "/" + id + "/progress", token, body("goodQty", 9, "defectQty", 2)), 422, "WORK_ORDER_QTY_EXCEEDED");
            assertThat(get(PATH + "/" + id, token).getBody().path("goodQty").decimalValue()).isEqualByComparingTo("0");
            error(post(PATH + "/" + id + "/complete", token, body()), 422, "GOOD_QTY_ZERO");
            error(post(PATH + "/" + id + "/close", token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(post(PATH + "/" + id + "/progress", token, body("goodQty", 1), "wo-partial").getBody().path("progress").decimalValue())
                    .isEqualByComparingTo("10");
            assertThat(post(PATH + "/" + id + "/progress", token, body("defectQty", 1), "wo-partial-two").getBody().path("progress").decimalValue())
                    .isEqualByComparingTo("20");
            error(patch(id, token, body("qty", 1), "wo-started-patch"), 409, "INVALID_STATE_TRANSITION");
        } finally { cleanup(id); }
        error(patch(999999, token, body("qty", 1), "wo-not-found"), 404, "WORK_ORDER_NOT_FOUND");
    }

    @Test
    void only_empty_independent_orders_can_be_deleted_or_cancelled() {
        String token = loginAdmin(); long id = create("T-WO-CANCEL", 4, token);
        try {
            assertThat(post(PATH + "/" + id + "/cancel", token, body(), "wo-cancel").getBody().path("status").asText()).isEqualTo("취소");
            for (String action : List.of("progress", "complete", "close", "cancel")) {
                error(post(PATH + "/" + id + "/" + action, token, body("goodQty", 10)), 409, "INVALID_STATE_TRANSITION");
            }
            error(delete(id, token, "wo-cancel-delete"), 409, "INVALID_STATE_TRANSITION");
            assertAudit("wo-cancel", true, true);
        } finally { cleanup(id); }
        long linked = create("T-WO-LINKED", 4, token);
        try {
            jdbc.update("update work_orders set sales_order_id = 3 where id = ?", linked);
            error(delete(linked, token, "wo-linked-delete"), 409, "IN_USE");
            error(post(PATH + "/" + linked + "/cancel", token, body()), 409, "IN_USE");
            error(patch(linked, token, body("qty", 11), "wo-linked-qty"), 422, "BUSINESS_RULE_VIOLATION");
            assertThat(patch(linked, token, body("assignee", "담당 변경"), "wo-linked-assignee").getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(linked); }
    }

    @Test
    void production_and_admin_write_while_other_roles_only_read() {
        createUser("wo-production", "password123", "PRODUCTION"); createUser("wo-viewer", "password123", "SALES");
        String production = login("wo-production", "password123"); String viewer = login("wo-viewer", "password123");
        long id = create("T-WO-ROLE", 4, production);
        try {
            assertThat(get(PATH, viewer).getStatusCode().value()).isEqualTo(200);
            error(post(PATH, viewer, valid("T-WO-DENIED", 4)), 403, "FORBIDDEN");
            error(patch(id, viewer, body("priority", 2), "wo-denied"), 403, "FORBIDDEN");
            error(delete(id, viewer, "wo-denied-delete"), 403, "FORBIDDEN");
            for (String action : List.of("progress", "complete", "close", "cancel")) {
                error(post(PATH + "/" + id + "/" + action, viewer, body("goodQty", 10)), 403, "FORBIDDEN");
            }
            assertThat(patch(id, production, body("priority", 2), "wo-role-patch").getStatusCode().value()).isEqualTo(200);
            assertThat(delete(id, production, "wo-role-delete").getStatusCode().value()).isEqualTo(204);
        } finally { cleanup(id); }
    }

    @Test
    void lists_filter_search_sort_paginate_and_reject_invalid_parameters() {
        String token = loginAdmin();
        var page = get(PATH + "?itemId=3&size=1&sort=qty,desc", token);
        assertThat(page.getStatusCode().value()).isEqualTo(200);
        assertThat(page.getBody().path("content")).hasSize(1);
        assertThat(page.getBody().path("content").get(0).path("qty").decimalValue()).isEqualByComparingTo("200");
        assertThat(get(PATH + "?salesOrderId=1&keyword=SO-2609-001", token).getBody().path("totalElements").asInt()).isEqualTo(1);
        assertThat(get(PATH + "?keyword=P-A001", token).getBody().path("totalElements").asInt()).isPositive();
        assertThat(get(PATH + "?keyword=%25", token).getBody().path("totalElements").asInt()).isZero();
        for (String query : List.of("size=101", "page=-1", "itemId=0", "salesOrderId=0", "status=unknown", "sort=unknown,asc")) {
            error(get(PATH + "?" + query, token), 400, "INVALID_INPUT");
        }
    }

    @Test
    void concurrent_same_and_different_orders_do_not_duplicate_receipts_or_lose_stock() throws Exception {
        String token = loginAdmin(); long itemId = item("T-WO-RACE");
        long one = create("T-WO-RACE-A", itemId, token), two = create("T-WO-RACE-B", itemId, token);
        try {
            var repeated = race(one, one, token);
            assertThat(repeated).extracting(r -> r.getStatusCode().value()).containsExactlyInAnyOrder(200, 409);
            assertThat(stock(itemId)).isEqualByComparingTo("8");
            assertThat(txnCount("T-WO-RACE-A")).isEqualTo(1);
            long three = create("T-WO-RACE-C", itemId, token);
            try {
                var parallel = race(two, three, token);
                assertThat(parallel).allSatisfy(r -> assertThat(r.getStatusCode().value()).isEqualTo(200));
                assertThat(stock(itemId)).isEqualByComparingTo("24");
            } finally { cleanup(three); }
        } finally { cleanup(one); cleanup(two); cleanupItem(itemId); }
    }

    @Test
    void audit_failure_rolls_back_work_order_lot_inventory_and_stock_together() {
        String token = loginAdmin(); long itemId = item("T-WO-ROLLBACK"); long id = create("T-WO-ROLLBACK", itemId, token);
        jdbc.execute("""
                create function test_reject_work_order_audit() returns trigger language plpgsql as $$
                begin
                    if NEW.trace_id = 'wo-rollback' then raise exception 'test audit rejection'; end if;
                    return NEW;
                end $$
                """);
        jdbc.execute("create trigger test_reject_work_order_audit before insert on audit_logs for each row execute function test_reject_work_order_audit()");
        try {
            assertThat(post(PATH + "/" + id + "/complete", token, body("goodQty", 8, "defectQty", 2), "wo-rollback").getStatusCode().value()).isEqualTo(500);
            var persisted = get(PATH + "/" + id, token).getBody();
            assertThat(persisted.path("status").asText()).isEqualTo("지시");
            assertThat(persisted.path("goodQty").decimalValue()).isEqualByComparingTo("0");
            assertThat(stock(itemId)).isEqualByComparingTo("0"); assertThat(txnCount("T-WO-ROLLBACK")).isZero();
            assertThat(jdbc.queryForObject("select count(*) from lots where item_id = ?", Long.class, itemId)).isZero();
        } finally {
            jdbc.execute("drop trigger test_reject_work_order_audit on audit_logs"); jdbc.execute("drop function test_reject_work_order_audit()");
            cleanup(id); cleanupItem(itemId);
        }
    }

    private List<ResponseEntity<JsonNode>> race(long first, long second, String token) throws Exception {
        var start = new CountDownLatch(1);
        java.util.function.Function<Long, ResponseEntity<JsonNode>> action = id -> {
            try { start.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            return post(PATH + "/" + id + "/complete", token, body("goodQty", 8, "defectQty", 2));
        };
        var one = CompletableFuture.supplyAsync(() -> action.apply(first)); var two = CompletableFuture.supplyAsync(() -> action.apply(second));
        start.countDown(); return List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS));
    }
    private Map<String, Object> valid(String code, long itemId) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        return body("workOrderNo", code, "itemId", itemId, "qty", 10, "dueDate", today.plusDays(10).toString());
    }
    private long create(String code, long itemId, String token) {
        var response = post(PATH, token, valid(code, itemId)); assertThat(response.getStatusCode().value()).isEqualTo(201);
        return response.getBody().path("id").asLong();
    }
    private long item(String code) {
        return jdbc.queryForObject("""
                insert into items(item_no, name, item_type, unit, price, stock, safety_stock, lead_time_days)
                values (?, '생산 검증 제품', '제품', 'EA', 100, 0, 0, 0) returning id
                """, Long.class, code);
    }
    private BigDecimal stock(long itemId) { return jdbc.queryForObject("select stock from items where id = ?", BigDecimal.class, itemId); }
    private long txnCount(String code) { return jdbc.queryForObject("select count(*) from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ?", Long.class, code); }
    private ResponseEntity<JsonNode> patch(long id, String token, Object request, String trace) {
        return rest.exchange(PATH + "/" + id, HttpMethod.PATCH, authEntity(token, request, trace), JsonNode.class);
    }
    private ResponseEntity<JsonNode> delete(long id, String token, String trace) {
        return rest.exchange(PATH + "/" + id, HttpMethod.DELETE, authEntity(token, null, trace), JsonNode.class);
    }
    private void cleanup(long id) { jdbc.update("delete from work_orders where id = ?", id); }
    private void cleanupItem(long id) {
        jdbc.update("delete from inventory_transactions where item_id = ?", id); jdbc.update("delete from lots where item_id = ?", id);
        jdbc.update("delete from items where id = ?", id);
    }
    private void error(ResponseEntity<JsonNode> r, int status, String code) {
        assertThat(r.getStatusCode().value()).isEqualTo(status); assertThat(r.getBody().path("code").asText()).isEqualTo(code);
    }
    private void assertAudit(String trace, boolean before, boolean after) {
        assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc(trace)).singleElement().satisfies(a -> {
            assertThat(a.getActorId()).isNotNull(); assertThat(a.getEntityType()).isEqualTo("WORK_ORDER");
            assertThat(a.getBeforeJson() != null).isEqualTo(before); assertThat(a.getAfterJson() != null).isEqualTo(after);
        });
    }
}
