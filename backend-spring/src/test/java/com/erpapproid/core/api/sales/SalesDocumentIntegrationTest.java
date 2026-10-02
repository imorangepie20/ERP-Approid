package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
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

class SalesDocumentIntegrationTest extends IntegrationTestSupport {
    private static final String Q = "/api/core/quotations";
    private static final String S = "/api/core/sales-orders";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void quotation_crud_recalculates_partial_amount_and_preserves_identity_and_terms() {
        String token = loginAdmin();
        var created = post(Q, token, quote("T-Q-CRUD"), "sales-q-create");
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            var patched = patch(Q, id, token, body("qty", 2.5), "sales-q-update");
            assertThat(patched.getStatusCode().value()).isEqualTo(200);
            assertThat(patched.getBody().path("amount").asLong()).isEqualTo(250);
            assertThat(patched.getBody().path("quotationNo").asText()).isEqualTo("T-Q-CRUD");
            assertThat(patched.getBody().path("customerId").asLong()).isEqualTo(1);
            assertThat(patched.getBody().path("paymentTerms")).isEqualTo(created.getBody().path("paymentTerms"));
            assertThat(patch(Q, id, token, body("unitPrice", 101), "sales-q-price").getBody().path("amount").asLong())
                    .isEqualTo(252); // 원 미만 버림
            assertThat(delete(Q, id, token, "sales-q-delete").getStatusCode().value()).isEqualTo(204);
            assertAudit("sales-q-create", "QUOTATION", false, true);
            assertAudit("sales-q-update", "QUOTATION", true, true);
            assertAudit("sales-q-delete", "QUOTATION", true, false);
        } finally { cleanupQuote(id); }
    }

    @Test
    void quotation_send_convert_confirm_is_persistent_audited_and_traceable() {
        String token = loginAdmin();
        var created = post(Q, token, quote("T-Q-FLOW"));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long qid = created.getBody().path("id").asLong();
        long sid = 0;
        try {
            error(post(S + "/from-quotation/" + qid, token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(post(Q + "/" + qid + "/send", token, body(), "sales-send").getBody().path("status").asText())
                    .isEqualTo("발송완료");
            error(patch(Q, qid, token, body("qty", 4), "sales-q-locked"), 409, "INVALID_STATE_TRANSITION");
            error(delete(Q, qid, token, "sales-q-locked-delete"), 409, "INVALID_STATE_TRANSITION");
            var converted = post(S + "/from-quotation/" + qid, token, body(), "sales-convert");
            assertThat(converted.getStatusCode().value()).isEqualTo(201);
            sid = converted.getBody().path("id").asLong();
            assertThat(converted.getBody().path("quotationId").asLong()).isEqualTo(qid);
            assertThat(converted.getBody().path("paymentTerms")).isEqualTo(created.getBody().path("paymentTerms"));
            assertThat(converted.getBody().path("leadTimeDays")).isEqualTo(created.getBody().path("leadTimeDays"));
            error(post(S + "/from-quotation/" + qid, token, body()), 409, "INVALID_STATE_TRANSITION");
            error(delete(S, sid, token, "sales-s-linked-delete"), 409, "IN_USE");
            var confirmed = post(S + "/" + sid + "/confirm", token, body(), "sales-confirm");
            assertThat(confirmed.getStatusCode().value()).isEqualTo(200);
            long wid = confirmed.getBody().path("workOrderId").asLong();
            var workOrder = get("/api/core/work-orders/" + wid, token).getBody();
            assertThat(workOrder.path("salesOrderId").asLong()).isEqualTo(sid);
            assertThat(workOrder.path("routingSteps")).isNotEmpty();
            assertThat(get(S + "/" + sid, token).getBody().path("workOrderNos").get(0))
                    .isEqualTo(confirmed.getBody().path("workOrderNo"));
            error(post(S + "/" + sid + "/confirm", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(post(S + "/" + sid + "/cancel", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(patch(S, sid, token, body("qty", 3), "sales-s-locked"), 409, "INVALID_STATE_TRANSITION");
            assertAudit("sales-send", "QUOTATION", true, true);
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("sales-convert")).hasSize(2);
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("sales-confirm")).hasSize(2)
                    .allSatisfy(a -> assertThat(a.getActorId()).isNotNull());
        } finally { cleanupOrder(sid); cleanupQuote(qid); }
    }

    @Test
    void direct_order_crud_and_cancel_only_waiting_orders() {
        String token = loginAdmin();
        var created = post(S, token, order("T-S-CRUD"), "sales-s-create");
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            var updated = patch(S, id, token, body("unitPrice", 200), "sales-s-update");
            assertThat(updated.getStatusCode().value()).isEqualTo(200);
            assertThat(updated.getBody().path("amount").asLong()).isEqualTo(400);
            assertThat(delete(S, id, token, "sales-s-delete").getStatusCode().value()).isEqualTo(204);
            assertAudit("sales-s-create", "SALES_ORDER", false, true);
            assertAudit("sales-s-update", "SALES_ORDER", true, true);
            assertAudit("sales-s-delete", "SALES_ORDER", true, false);
        } finally { cleanupOrder(id); }
        var cancelled = post(S, token, order("T-S-CANCEL"));
        long cancelId = cancelled.getBody().path("id").asLong();
        try {
            assertThat(post(S + "/" + cancelId + "/cancel", token, body(), "sales-cancel").getBody().path("status").asText())
                    .isEqualTo("취소");
            error(post(S + "/" + cancelId + "/cancel", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(post(S + "/" + cancelId + "/confirm", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(delete(S, cancelId, token, "sales-cancel-delete"), 409, "INVALID_STATE_TRANSITION");
            assertAudit("sales-cancel", "SALES_ORDER", true, true);
        } finally { cleanupOrder(cancelId); }
    }

    @Test
    void validates_precision_references_duplicates_overflow_empty_patch_and_expiry() {
        String token = loginAdmin();
        for (Map<String, Object> invalid : List.of(body("qty", 0), body("qty", 0.00001), body("unitPrice", 0),
                body("quotationNo", "x".repeat(33)), body("customerId", 0), body("unitPrice", 9007199254740992L),
                body("qty", 90071992547409L, "unitPrice", 1000))) {
            var request = quote("T-Q-INVALID"); request.putAll(invalid);
            error(post(Q, token, request), 400, "INVALID_INPUT");
        }
        var supplier = quote("T-Q-SUPPLIER"); supplier.put("customerId", 6);
        error(post(Q, token, supplier), 422, "BUSINESS_RULE_VIOLATION");
        var material = order("T-S-MATERIAL"); material.put("itemId", 6);
        error(post(S, token, material), 422, "ITEM_NOT_PRODUCIBLE");
        var bypass = order("T-S-BYPASS"); bypass.put("quotationId", 4);
        error(post(S, token, bypass), 400, "INVALID_INPUT");
        var duplicate = quote("QT-2609-001");
        error(post(Q, token, duplicate), 409, "QUOTATION_NO_DUPLICATE");
        error(post(S, token, order("SO-2609-001")), 409, "SALES_ORDER_NO_DUPLICATE");
        error(patch(Q, 4, token, body(), "sales-empty-q"), 400, "INVALID_INPUT");
        error(patch(S, 3, token, body(), "sales-empty-s"), 400, "INVALID_INPUT");
        error(patch(S, 999999, token, body("qty", 1), "sales-missing"), 404, "SALES_ORDER_NOT_FOUND");
        var expired = quote("T-Q-EXPIRED"); expired.put("validUntil", today().minusDays(1).toString());
        var created = post(Q, token, expired);
        long id = created.getBody().path("id").asLong();
        try {
            error(post(Q + "/" + id + "/send", token, body()), 409, "QUOTATION_EXPIRED");
            jdbc.update("update quotations set status = '발송완료' where id = ?", id);
            error(post(S + "/from-quotation/" + id, token, body()), 409, "QUOTATION_EXPIRED");
        } finally { cleanupQuote(id); }
    }

    @Test
    void sales_and_admin_write_while_other_roles_only_read() {
        createUser("doc-sales", "password123", "SALES");
        createUser("doc-viewer", "password123", "PRODUCTION");
        String sales = login("doc-sales", "password123");
        String viewer = login("doc-viewer", "password123");
        for (String path : List.of(Q, S)) {
            assertThat(get(path, viewer).getStatusCode().value()).isEqualTo(200);
            error(post(path, viewer, path.equals(Q) ? quote("T-Q-DENIED") : order("T-S-DENIED")), 403, "FORBIDDEN");
            error(patch(path, 4, viewer, body("qty", 1), "sales-denied"), 403, "FORBIDDEN");
            error(delete(path, 4, viewer, "sales-denied-delete"), 403, "FORBIDDEN");
        }
        error(post(Q + "/4/send", viewer, body()), 403, "FORBIDDEN");
        error(post(S + "/from-quotation/4", viewer, body()), 403, "FORBIDDEN");
        error(post(S + "/3/confirm", viewer, body()), 403, "FORBIDDEN");
        error(post(S + "/3/cancel", viewer, body()), 403, "FORBIDDEN");
        var q = post(Q, sales, quote("T-Q-ROLE"));
        assertThat(q.getStatusCode().value()).isEqualTo(201);
        long id = q.getBody().path("id").asLong();
        try {
            assertThat(patch(Q, id, sales, body("qty", 1), "sales-role").getStatusCode().value()).isEqualTo(200);
            assertThat(delete(Q, id, sales, "sales-role-delete").getStatusCode().value()).isEqualTo(204);
        } finally { cleanupQuote(id); }
    }

    @Test
    void lists_search_customer_and_item_filter_sort_paginate_and_reject_invalid_queries() {
        String token = loginAdmin();
        for (String path : List.of(Q, S)) {
            var list = get(path + "?customerId=1&size=1&sort=amount,desc", token);
            assertThat(list.getStatusCode().value()).isEqualTo(200);
            assertThat(list.getBody().path("content")).hasSize(1);
            assertThat(list.getBody().path("content").get(0).path("customerId").asLong()).isEqualTo(1);
            assertThat(get(path + "?keyword=P-A001", token).getBody().path("totalElements").asInt()).isPositive();
            assertThat(get(path + "?keyword=%25", token).getBody().path("totalElements").asInt()).isZero();
            for (String query : List.of("size=101", "page=-1", "customerId=0", "status=unknown", "sort=unknown,asc")) {
                error(get(path + "?" + query, token), 400, "INVALID_INPUT");
            }
        }
    }

    @Test
    void document_terms_remain_as_quoted_after_customer_master_changes() {
        String token = loginAdmin();
        Long customer = jdbc.queryForObject("""
                insert into partners(partner_no, name, payment_terms, lead_time_days, partner_type)
                values ('T-DOC-TERMS', '문서 조건 고객', 60, 9, '고객사') returning id
                """, Long.class);
        long qid = 0, sid = 0;
        try {
            var request = quote("T-Q-TERMS"); request.put("customerId", customer);
            request.put("validUntil", today().toString()); // 유효기간 마지막 날은 전환 가능
            var created = post(Q, token, request);
            assertThat(created.getStatusCode().value()).isEqualTo(201);
            qid = created.getBody().path("id").asLong();
            jdbc.update("update partners set payment_terms = 30, lead_time_days = 2 where id = ?", customer);
            assertThat(post(Q + "/" + qid + "/send", token, body()).getStatusCode().value()).isEqualTo(200);
            var converted = post(S + "/from-quotation/" + qid, token, body());
            assertThat(converted.getStatusCode().value()).isEqualTo(201);
            sid = converted.getBody().path("id").asLong();
            assertThat(converted.getBody().path("paymentTerms").asInt()).isEqualTo(60);
            assertThat(converted.getBody().path("leadTimeDays").asInt()).isEqualTo(9);
            assertThat(post(S + "/" + sid + "/cancel", token, body()).getStatusCode().value()).isEqualTo(200);
            assertThat(get(Q + "/" + qid, token).getBody().path("status").asText()).isEqualTo("수주완료");
        } finally { cleanupOrder(sid); cleanupQuote(qid); jdbc.update("delete from partners where id = ?", customer); }
    }

    @Test
    void concurrent_conversion_and_confirmation_create_only_one_child() throws Exception {
        String token = loginAdmin();
        var q = post(Q, token, quote("T-Q-RACE"));
        long qid = q.getBody().path("id").asLong();
        long sid = 0;
        try {
            assertThat(post(Q + "/" + qid + "/send", token, body()).getStatusCode().value()).isEqualTo(200);
            var conversion = race(S + "/from-quotation/" + qid, token);
            assertThat(conversion).extracting(r -> r.getStatusCode().value()).containsExactlyInAnyOrder(201, 409);
            sid = conversion.stream().filter(r -> r.getStatusCode().value() == 201).findFirst().orElseThrow().getBody().path("id").asLong();
            var confirmation = race(S + "/" + sid + "/confirm", token);
            assertThat(confirmation).extracting(r -> r.getStatusCode().value()).containsExactlyInAnyOrder(200, 409);
            assertThat(jdbc.queryForObject("select count(*) from work_orders where sales_order_id = ?", Long.class, sid)).isEqualTo(1);
        } finally { cleanupOrder(sid); cleanupQuote(qid); }
    }

    private List<ResponseEntity<JsonNode>> race(String path, String token) throws Exception {
        var start = new CountDownLatch(1);
        java.util.function.Supplier<ResponseEntity<JsonNode>> action = () -> {
            try { start.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            return post(path, token, body());
        };
        var one = CompletableFuture.supplyAsync(action); var two = CompletableFuture.supplyAsync(action);
        start.countDown();
        return List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS));
    }
    private Map<String, Object> quote(String code) {
        return body("quotationNo", code, "customerId", 1, "itemId", 1, "qty", 2, "unitPrice", 100,
                "dueDate", today().plusDays(30).toString(), "validUntil", today().plusDays(10).toString());
    }
    private Map<String, Object> order(String code) {
        return body("salesOrderNo", code, "customerId", 1, "itemId", 1, "qty", 2, "unitPrice", 100,
                "dueDate", today().plusDays(30).toString());
    }
    private LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }
    private ResponseEntity<JsonNode> patch(String path, long id, String token, Object request, String trace) {
        return rest.exchange(path + "/" + id, HttpMethod.PATCH, authEntity(token, request, trace), JsonNode.class);
    }
    private ResponseEntity<JsonNode> delete(String path, long id, String token, String trace) {
        return rest.exchange(path + "/" + id, HttpMethod.DELETE, authEntity(token, null, trace), JsonNode.class);
    }
    private void cleanupOrder(long id) {
        jdbc.update("delete from work_orders where sales_order_id = ?", id);
        jdbc.update("delete from sales_orders where id = ?", id);
    }
    private void cleanupQuote(long id) { jdbc.update("delete from quotations where id = ?", id); }
    private void error(ResponseEntity<JsonNode> r, int status, String code) {
        assertThat(r.getStatusCode().value()).isEqualTo(status);
        assertThat(r.getBody().path("code").asText()).isEqualTo(code);
    }
    private void assertAudit(String trace, String type, boolean before, boolean after) {
        assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc(trace)).singleElement().satisfies(a -> {
            assertThat(a.getEntityType()).isEqualTo(type);
            assertThat(a.getActorId()).isNotNull();
            assertThat(a.getBeforeJson() != null).isEqualTo(before);
            assertThat(a.getAfterJson() != null).isEqualTo(after);
        });
    }
}
