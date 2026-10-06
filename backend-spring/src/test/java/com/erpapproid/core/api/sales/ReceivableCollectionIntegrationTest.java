package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

class ReceivableCollectionIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    private static final String PATH = "/api/core/receivables/";
    private LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }

    @Test void partial_then_full_collection_records_amount_date_balance_actor_and_sensitive_audit() {
        long id = receivable(); String token = loginAdmin();
        try {
            long actor = userRepository.findByUsername("admin").orElseThrow().getId();
            var first = input(30); var response = post(PATH + id + "/collect", token, first, "collection-trace");
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            var d = response.getBody();
            assertThat(d.path("receivable").path("collectedAmount").asLong()).isEqualTo(30);
            assertThat(d.path("receivable").path("remainingAmount").asLong()).isEqualTo(70);
            assertThat(d.path("receivable").path("status").asText()).isEqualTo("미수");
            assertThat(d.path("collection").path("collectedOn").asText()).isEqualTo(today().toString());
            assertThat(d.path("collection").path("actorId").asLong()).isEqualTo(actor);
            assertThat(d.path("collection").path("traceId").asText()).isEqualTo("collection-trace");
            assertThat(post(PATH + id + "/collect", token, first).getBody().path("replayed").asBoolean()).isTrue();
            var finalPayment = post(PATH + id + "/collect", token, input(70)).getBody();
            assertThat(finalPayment.path("receivable").path("remainingAmount").asLong()).isZero();
            assertThat(finalPayment.path("receivable").path("status").asText()).isEqualTo("수납완료");
            assertThat(post(PATH + id + "/collect", token, input(1)).getStatusCode().value()).isEqualTo(409);
            var detail = get(PATH + id, token).getBody();
            assertThat(detail.path("collections").path("totalElements").asInt()).isEqualTo(2);
            assertThat(detail.path("collections").path("content").get(0).path("remainingAmount").asLong()).isZero();
            assertThat(jdbc.queryForObject("select count(*) from audit_logs where entity_type='RECEIVABLE' and entity_no=(select receivable_no from receivables where id=?) and sensitive=true", Long.class, id)).isEqualTo(2);
            assertThat(jdbc.queryForObject("select amount from receivables where id=?", Long.class, id)).isEqualTo(100);
        } finally { cleanup(id); }
    }

    @Test void rejects_overpayments_changed_retries_invalid_dates_and_missing_body_without_writes() {
        long id = receivable(); String token = loginAdmin();
        try {
            for (var request : List.of(input(0), input(-1), body("amount", 1, "collectedOn", today().plusDays(1), "requestId", UUID.randomUUID()),
                    body("amount", 1.5, "collectedOn", today(), "requestId", UUID.randomUUID()), body("amount", "1", "collectedOn", today(), "requestId", UUID.randomUUID()),
                    body("amount", 1, "collectedOn", "bad", "requestId", UUID.randomUUID()), body("amount", 1, "collectedOn", today(), "requestId", "bad"), body("amount", 1))) {
                assertThat(post(PATH + id + "/collect", token, request).getStatusCode().value()).isEqualTo(400);
            }
            assertThat(post(PATH + id + "/collect", token, null).getStatusCode().value()).isEqualTo(400);
            assertThat(post(PATH + id + "/collect", token, input(101)).getStatusCode().value()).isEqualTo(422);
            var request = input(30); assertThat(post(PATH + id + "/collect", token, request).getStatusCode().value()).isEqualTo(200);
            request.put("amount", 31);
            assertThat(post(PATH + id + "/collect", token, request).getStatusCode().value()).isEqualTo(409);
            assertThat(jdbc.queryForObject("select count(*) from receivable_collections where receivable_id=?", Long.class, id)).isEqualTo(1);
            assertThat(get(PATH + id, token).getBody().path("receivable").path("remainingAmount").asLong()).isEqualTo(70);
        } finally { cleanup(id); }
    }

    @Test void serializes_competing_amounts_and_same_request_retries() throws Exception {
        long id = receivable(); String token = loginAdmin();
        try {
            var gate = new CountDownLatch(1);
            var a = CompletableFuture.supplyAsync(() -> { await(gate); return post(PATH + id + "/collect", token, input(60)).getStatusCode().value(); });
            var b = CompletableFuture.supplyAsync(() -> { await(gate); return post(PATH + id + "/collect", token, input(60)).getStatusCode().value(); });
            gate.countDown(); assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 422);
            var request = input(40); var again = new CountDownLatch(1);
            var c = CompletableFuture.supplyAsync(() -> { await(again); return post(PATH + id + "/collect", token, request).getStatusCode().value(); });
            var d = CompletableFuture.supplyAsync(() -> { await(again); return post(PATH + id + "/collect", token, request).getStatusCode().value(); });
            again.countDown(); assertThat(List.of(c.get(30, TimeUnit.SECONDS), d.get(30, TimeUnit.SECONDS))).containsOnly(200);
            assertThat(jdbc.queryForObject("select count(*) from receivable_collections where receivable_id=?", Long.class, id)).isEqualTo(2);
            assertThat(get(PATH + id, token).getBody().path("receivable").path("remainingAmount").asLong()).isZero();
        } finally { cleanup(id); }
    }

    @Test void retains_read_roles_but_limits_writes_and_replay_actor_and_pages_history() {
        long id = receivable(); var admin = loginAdmin();
        try {
            for (String role : new String[]{"SALES", "ACCOUNTING", "PRODUCTION"}) {
                String name = "collection-" + role.toLowerCase(); createUser(name, "password123", role); var token = login(name, "password123");
                assertThat(get(PATH + id, token).getStatusCode().value()).isEqualTo(role.equals("PRODUCTION") ? 403 : 200);
                assertThat(post(PATH + id + "/collect", token, input(1)).getStatusCode().value()).isEqualTo(role.equals("ACCOUNTING") ? 200 : 403);
            }
            var request = input(1); post(PATH + id + "/collect", admin, request);
            assertThat(post(PATH + id + "/collect", login("collection-accounting", "password123"), request).getStatusCode().value()).isEqualTo(409);
            var secondPage = get(PATH + id + "?size=1&page=1", admin).getBody().path("collections");
            assertThat(secondPage.path("content")).hasSize(1); assertThat(secondPage.path("totalElements").asInt()).isEqualTo(2);
            assertThat(get(PATH + id + "?size=101", admin).getStatusCode().value()).isEqualTo(400);
            assertThat(get(PATH + Long.MAX_VALUE, admin).getStatusCode().value()).isEqualTo(404);
        } finally { cleanup(id); }
    }

    @Test void rolls_back_ledger_balance_and_status_when_audit_insert_fails() {
        long id = receivable(); String token = loginAdmin();
        try {
            jdbc.execute("create function test_collection_audit_fail() returns trigger as $$ begin if NEW.action='COLLECT' then raise exception 'test audit failure'; end if; return NEW; end; $$ language plpgsql");
            jdbc.execute("create trigger test_collection_audit_fail before insert on audit_logs for each row execute function test_collection_audit_fail()");
            assertThat(post(PATH + id + "/collect", token, input(30)).getStatusCode().value()).isEqualTo(500);
            assertThat(jdbc.queryForObject("select collected_amount from receivables where id=?", Long.class, id)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from receivable_collections where receivable_id=?", Long.class, id)).isZero();
        } finally {
            jdbc.execute("drop trigger if exists test_collection_audit_fail on audit_logs");
            jdbc.execute("drop function if exists test_collection_audit_fail()"); cleanup(id);
        }
    }

    @Test void summary_adds_remaining_balances_without_reinterpreting_original_document_principal() {
        long id = receivable(); String token = loginAdmin();
        try {
            var before = get("/api/core/receivables/summary", token).getBody(); post(PATH + id + "/collect", token, input(30));
            var after = get("/api/core/receivables/summary", token).getBody();
            assertThat(after.path("openAmount").asLong()).isEqualTo(before.path("openAmount").asLong());
            assertThat(after.path("openBalance").asLong()).isEqualTo(before.path("openBalance").asLong() - 30);
            assertThat(after.path("overdueBalance").asLong()).isEqualTo(before.path("overdueBalance").asLong() - 30);
        } finally { cleanup(id); }
    }

    private long receivable() {
        return jdbc.queryForObject("insert into receivables(receivable_no,customer_id,amount,due_date,status) values(?,1,100,?,'미수') returning id", Long.class,
                "COL-" + UUID.randomUUID().toString().substring(0, 20), today().minusDays(3));
    }
    private java.util.Map<String, Object> input(int amount) { return body("amount", amount, "collectedOn", today(), "requestId", UUID.randomUUID()); }
    private void cleanup(long id) {
        jdbc.update("delete from receivable_collections where receivable_id=?", id);
        jdbc.update("delete from receivables where id=?", id);
    }
    private static void await(CountDownLatch gate) { try { if (!gate.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out"); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); } }
}
