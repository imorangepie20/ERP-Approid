package com.erpapproid.core.api.purchase;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
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

class ReceivingIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/receivings";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void partial_full_receipts_and_compensations_keep_stock_lots_and_order_totals_consistent() {
        String token = loginAdmin(); long item = item("T-RC-FLOW"), po = po("T-RC-FLOW", item);
        try {
            var first = receive(po, 6, 2, token, "rc-first"); assertThat(first.getStatusCode().value()).isEqualTo(201);
            JsonNode receipt = first.getBody().path("receiving"); long id = receipt.path("id").asLong();
            assertThat(receipt.path("status").asText()).isEqualTo("부분합격"); assertThat(receipt.path("goodQty").decimalValue()).isEqualByComparingTo("4");
            assertThat(receipt.path("stockApplied").asBoolean()).isTrue();
            assertThat(receipt.path("lotNo").asText()).isEqualTo(first.getBody().path("lotNo").asText());
            assertThat(stock(item)).isEqualByComparingTo("9"); assertPo(po, "부분입고", "6"); assertAudits("rc-first", 5);
            var second = receive(po, 4, 0, token, "rc-second"); assertThat(second.getStatusCode().value()).isEqualTo(201);
            assertPo(po, "입고완료", "10"); assertThat(stock(item)).isEqualByComparingTo("13");
            assertThat(cancel(id, token, "rc-cancel").getStatusCode().value()).isEqualTo(200);
            var cancelled = get(PATH + "/" + id, token).getBody();
            assertThat(cancelled.path("status").asText()).isEqualTo("취소"); assertThat(cancelled.path("cancelledDate").isTextual()).isTrue();
            assertThat(cancelled.path("reversalTxnNo").asText()).startsWith("IVT-");
            assertPo(po, "부분입고", "4"); assertThat(stock(item)).isEqualByComparingTo("9"); assertAudits("rc-cancel", 5);
            assertThat(jdbc.queryForObject("select qty from lots where lot_no = ?", BigDecimal.class, receipt.path("lotNo").asText())).isEqualByComparingTo("0");
            error(cancel(id, token, "rc-repeat"), 409, "INVALID_STATE_TRANSITION");
            assertThat(cancel(second.getBody().path("receiving").path("id").asLong(), token, "rc-cancel-second").getStatusCode().value()).isEqualTo(200);
            assertPo(po, "발주", "0"); assertThat(stock(item)).isEqualByComparingTo("5");
            assertThat(jdbc.queryForObject("select sum(qty) from inventory_transactions where item_id = ?", BigDecimal.class, item)).isEqualByComparingTo("0");
        } finally { cleanup(item); }
    }

    @Test
    void all_defective_receipt_has_no_lot_or_stock_movement_but_can_be_cancelled() {
        String token = loginAdmin(); long item = item("T-RC-FAIL"), po = po("T-RC-FAIL", item);
        try {
            var result = receive(po, 10, 10, token, "rc-all-defect"); assertThat(result.getStatusCode().value()).isEqualTo(201);
            var receipt = result.getBody().path("receiving"); assertThat(receipt.path("status").asText()).isEqualTo("불합격");
            assertThat(result.getBody().hasNonNull("lotNo")).isFalse(); assertThat(result.getBody().hasNonNull("inventoryTxnNo")).isFalse();
            assertThat(jdbc.queryForObject("select count(*) from lots where item_id = ?", Long.class, item)).isZero();
            assertPo(po, "입고완료", "10"); assertThat(stock(item)).isEqualByComparingTo("5"); assertAudits("rc-all-defect", 3);
            assertThat(cancel(receipt.path("id").asLong(), token, "rc-fail-cancel").getStatusCode().value()).isEqualTo(200);
            assertPo(po, "발주", "0"); assertAudits("rc-fail-cancel", 3);
        } finally { cleanup(item); }
    }

    @Test
    void validates_positive_quantities_defects_precision_references_and_preserves_history() {
        String token = loginAdmin(); long item = item("T-RC-INVALID"), po = po("T-RC-INVALID", item);
        try {
            for (var invalid : List.of(body("receivedQty", 0), body("receivedQty", -1), body("receivedQty", 0.00001),
                    body("defectQty", -1), body("defectQty", 0.00001), body("purchaseOrderId", 0))) {
                var request = body("purchaseOrderId", po, "receivedQty", 1, "defectQty", 0); request.putAll(invalid);
                error(post(PATH, token, request), 400, "INVALID_INPUT");
            }
            error(receive(po, 1, 2, token, "rc-invalid-defect"), 422, "BUSINESS_RULE_VIOLATION");
            error(receive(po, 11, 0, token, "rc-exceeds"), 422, "RECEIVED_QTY_EXCEEDS_ORDER");
            error(receive(999999, 1, 0, token, "rc-missing"), 404, "PURCHASE_ORDER_NOT_FOUND");
            error(receive(1, 1, 0, token, "rc-closed"), 409, "PURCHASE_ORDER_CLOSED");
            error(receive(6, 1, 0, token, "rc-cancelled"), 409, "PURCHASE_ORDER_CLOSED");
            error(cancel(1, token, "rc-historical"), 409, "IN_USE");
            error(rest.exchange(PATH + "/1", HttpMethod.DELETE, authEntity(token, null), JsonNode.class), 409, "IN_USE");
            assertThat(get(PATH + "/1", token).getBody().path("stockApplied").asBoolean()).isFalse();
            assertThat(stock(item)).isEqualByComparingTo("5"); assertPo(po, "발주", "0");
        } finally { cleanup(item); }
    }

    @Test
    void rejects_used_held_and_disposed_lots_and_preserves_cancelled_purchase_order_state() {
        String token = loginAdmin(); long item = item("T-RC-USED"), po = po("T-RC-USED", item);
        try {
            var receipt = receive(po, 6, 1, token, "rc-used-create").getBody().path("receiving"); long id = receipt.path("id").asLong();
            long lot = jdbc.queryForObject("select lot_id from receivings where id = ?", Long.class, id);
            jdbc.update("update lots set qty = 4 where id = ?", lot); error(cancel(id, token, "rc-used"), 409, "IN_USE");
            jdbc.update("update lots set qty = 5 where id = ?", lot);
            jdbc.update("insert into inventory_transactions(txn_no,item_id,lot_id,warehouse,txn_type,qty,txn_date) values ('T-RC-OTHER',?,?,'자재창고','이동',0,current_date)", item, lot);
            error(cancel(id, token, "rc-other-ref"), 409, "IN_USE"); jdbc.update("delete from inventory_transactions where txn_no = 'T-RC-OTHER'");
            assertThat(post("/api/core/lots/" + lot + "/hold", token, body()).getStatusCode().value()).isEqualTo(200);
            error(cancel(id, token, "rc-held"), 409, "IN_USE");
            assertThat(post("/api/core/lots/" + lot + "/release", token, body()).getStatusCode().value()).isEqualTo(200);
            assertThat(post("/api/core/purchase-orders/" + po + "/cancel", token, body()).getStatusCode().value()).isEqualTo(200);
            assertThat(cancel(id, token, "rc-after-po-cancel").getStatusCode().value()).isEqualTo(200);
            assertPo(po, "취소", "0"); assertThat(stock(item)).isEqualByComparingTo("5");
            error(post("/api/core/lots/" + lot + "/hold", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(post("/api/core/lots/" + lot + "/dispose", token, body()), 409, "INVALID_STATE_TRANSITION");
        } finally { cleanup(item); }
    }

    @Test
    void material_and_admin_write_other_roles_only_read() {
        createUser("rc-material", "password123", "MATERIAL"); createUser("rc-sales", "password123", "SALES");
        String material = login("rc-material", "password123"), viewer = login("rc-sales", "password123");
        long item = item("T-RC-ROLE"), po = po("T-RC-ROLE", item);
        try {
            assertThat(get(PATH, viewer).getStatusCode().value()).isEqualTo(200);
            assertThat(get("/api/core/purchase-orders?size=100", viewer).getStatusCode().value()).isEqualTo(200);
            error(receive(po, 1, 0, viewer, "rc-denied"), 403, "FORBIDDEN");
            long id = receive(po, 1, 0, material, "rc-role-create").getBody().path("receiving").path("id").asLong();
            error(cancel(id, viewer, "rc-denied-cancel"), 403, "FORBIDDEN");
            assertThat(cancel(id, material, "rc-role-cancel").getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(item); }
    }

    @Test
    void list_filters_search_sort_page_and_input_boundaries() {
        String token = loginAdmin(); long item = item("T-RC-LIST"), po = po("T-RC-LIST", item);
        try {
            receive(po, 2, 0, token, "rc-list-one"); receive(po, 3, 1, token, "rc-list-two");
            var result = get(PATH + "?purchaseOrderId=" + po + "&vendorId=5&itemId=" + item + "&keyword=T-RC-LIST&size=1&sort=receivedQty,desc", token);
            assertThat(result.getStatusCode().value()).isEqualTo(200); assertThat(result.getBody().path("totalElements").asInt()).isEqualTo(2);
            assertThat(result.getBody().path("content").get(0).path("receivedQty").decimalValue()).isEqualByComparingTo("3");
            assertThat(get(PATH + "?keyword=%25", token).getBody().path("totalElements").asInt()).isZero();
            for (String query : List.of("size=101", "page=-1", "purchaseOrderId=0", "vendorId=-1", "itemId=0", "status=unknown", "sort=unknown,asc")) {
                error(get(PATH + "?" + query, token), 400, "INVALID_INPUT");
            }
            error(get("/api/core/purchase-orders?size=101", token), 400, "INVALID_INPUT");
        } finally { cleanup(item); }
    }

    @Test
    void concurrent_receipts_do_not_exceed_order_or_lose_same_item_stock_and_cancel_only_once() throws Exception {
        String token = loginAdmin(); long item = item("T-RC-RACE"), po = po("T-RC-RACE-A", item);
        try {
            var raced = race(() -> receive(po, 6, 1, token, "rc-race-a"), () -> receive(po, 6, 1, token, "rc-race-b"));
            assertThat(raced).extracting(r -> r.getStatusCode().value()).containsExactlyInAnyOrder(201, 422);
            assertPo(po, "부분입고", "6"); assertThat(stock(item)).isEqualByComparingTo("10");
            long one = po("T-RC-RACE-B", item), two = po("T-RC-RACE-C", item);
            assertThat(race(() -> receive(one, 4, 0, token, "rc-race-c"), () -> receive(two, 4, 0, token, "rc-race-d")))
                    .allSatisfy(r -> assertThat(r.getStatusCode().value()).isEqualTo(201));
            assertThat(stock(item)).isEqualByComparingTo("18");
            long id = jdbc.queryForObject("select id from receivings where purchase_order_id = ?", Long.class, po);
            assertThat(race(() -> cancel(id, token, "rc-race-cancel-a"), () -> cancel(id, token, "rc-race-cancel-b")))
                    .extracting(r -> r.getStatusCode().value()).containsExactlyInAnyOrder(200, 409);
            assertThat(stock(item)).isEqualByComparingTo("13");
        } finally { cleanup(item); }
    }

    @Test
    void audit_failure_rolls_back_creation_and_compensation_all_entities() {
        String token = loginAdmin(); long item = item("T-RC-ROLLBACK"), po = po("T-RC-ROLLBACK", item);
        jdbc.execute("create function test_reject_receiving_audit() returns trigger language plpgsql as $$ begin if NEW.trace_id = 'rc-rollback' then raise exception 'test audit rejection'; end if; return NEW; end $$");
        jdbc.execute("create trigger test_reject_receiving_audit before insert on audit_logs for each row execute function test_reject_receiving_audit()");
        try {
            assertThat(receive(po, 6, 1, token, "rc-rollback").getStatusCode().value()).isEqualTo(500);
            assertPo(po, "발주", "0"); assertThat(stock(item)).isEqualByComparingTo("5");
            assertThat(jdbc.queryForObject("select count(*) from receivings where purchase_order_id = ?", Long.class, po)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from lots where item_id = ?", Long.class, item)).isZero();
            var receipt = receive(po, 6, 1, token, "rc-before-rollback").getBody().path("receiving"); long id = receipt.path("id").asLong();
            assertThat(cancel(id, token, "rc-rollback").getStatusCode().value()).isEqualTo(500);
            assertPo(po, "부분입고", "6"); assertThat(stock(item)).isEqualByComparingTo("10");
            assertThat(get(PATH + "/" + id, token).getBody().path("status").asText()).isEqualTo("부분합격");
            assertThat(jdbc.queryForObject("select qty from lots where lot_no = ?", BigDecimal.class, receipt.path("lotNo").asText())).isEqualByComparingTo("5");
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where item_id = ?", Long.class, item)).isEqualTo(1);
        } finally {
            jdbc.execute("drop trigger test_reject_receiving_audit on audit_logs"); jdbc.execute("drop function test_reject_receiving_audit()"); cleanup(item);
        }
    }

    private long item(String no) { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'입고 검증 자재','자재','KG',100,5,0,0) returning id", Long.class, no); }
    private long po(String no, long item) { return jdbc.queryForObject("insert into purchase_orders(purchase_order_no,vendor_id,item_id,qty,unit_price,amount,due_date,status,received_qty) values (?,5,?,10,100,1000,current_date,'발주',0) returning id", Long.class, no, item); }
    private BigDecimal stock(long item) { return jdbc.queryForObject("select stock from items where id = ?", BigDecimal.class, item); }
    private void assertPo(long id, String status, String qty) { var row = get("/api/core/purchase-orders/" + id, loginAdmin()).getBody(); assertThat(row.path("status").asText()).isEqualTo(status); assertThat(row.path("receivedQty").decimalValue()).isEqualByComparingTo(qty); }
    private ResponseEntity<JsonNode> receive(long po, double qty, double defects, String token, String trace) { return post(PATH, token, body("purchaseOrderId", po, "receivedQty", qty, "defectQty", defects), trace); }
    private ResponseEntity<JsonNode> cancel(long id, String token, String trace) { return post(PATH + "/" + id + "/cancel", token, body(), trace); }
    private void error(ResponseEntity<JsonNode> r, int status, String code) { assertThat(r.getStatusCode().value()).isEqualTo(status); assertThat(r.getBody().path("code").asText()).isEqualTo(code); }
    private void assertAudits(String trace, int size) { assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc(trace)).hasSize(size).allSatisfy(a -> { assertThat(a.getActorId()).isNotNull(); assertThat(a.getAfterJson()).isNotNull(); }); }
    private List<ResponseEntity<JsonNode>> race(java.util.function.Supplier<ResponseEntity<JsonNode>> first, java.util.function.Supplier<ResponseEntity<JsonNode>> second) throws Exception {
        var start = new CountDownLatch(1);
        java.util.function.Function<java.util.function.Supplier<ResponseEntity<JsonNode>>, ResponseEntity<JsonNode>> call = action -> { try { start.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); } return action.get(); };
        var one = CompletableFuture.supplyAsync(() -> call.apply(first)); var two = CompletableFuture.supplyAsync(() -> call.apply(second)); start.countDown();
        return List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS));
    }
    private void cleanup(long item) {
        jdbc.update("delete from receivings where item_id = ?", item); jdbc.update("delete from inventory_transactions where item_id = ?", item);
        jdbc.update("delete from lots where item_id = ?", item); jdbc.update("delete from purchase_orders where item_id = ?", item); jdbc.update("delete from items where id = ?", item);
    }
}
