package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class ShipmentIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;
    private static final String PATH = "/api/core/shipments";

    @Test void partial_and_full_shipments_decrease_lot_stock_and_use_snapshot_terms() {
        var f = fixture("FLOW"); var token = loginAdmin();
        try {
            long first = create(f, 4, token); dispatch(first, token);
            var result = post(PATH + "/" + first + "/confirm", token, body(), "sh-partial");
            assertThat(result.getStatusCode().value()).isEqualTo(200);
            assertThat(result.getBody().path("inventoryTxnNo").asText()).startsWith("IVT-");
            assertThat(result.getBody().path("shipment").path("lotNo").asText()).isEqualTo("T-SH-FLOW");
            assertThat(stock(f)).isEqualByComparingTo("6"); assertThat(lotQty(f)).isEqualByComparingTo("6"); assertOrder(f, "확정");
            assertThat(jdbc.queryForObject("select due_date from receivables where sales_order_id=?", LocalDate.class, f.order)).isEqualTo(today().plusDays(7));
            assertAudits("sh-partial");
            long last = create(f, 6, token); dispatch(last, token);
            assertThat(post(PATH + "/" + last + "/depart", token, body()).getStatusCode().value()).isEqualTo(200);
            assertThat(post(PATH + "/" + last + "/cancel", token, body()).getStatusCode().value()).isEqualTo(409);
            assertThat(post(PATH + "/" + last + "/confirm", token, body(), "sh-full").getStatusCode().value()).isEqualTo(200);
            assertOrder(f, "출하완료"); assertThat(stock(f)).isZero(); assertThat(lotQty(f)).isZero(); assertAudits("sh-full");
            assertThat(jdbc.queryForObject("select sum(amount) from receivables where sales_order_id=?", Long.class, f.order)).isEqualTo(103L);
            assertThat(jdbc.queryForObject("select sum(qty) from inventory_transactions where item_id=?", BigDecimal.class, f.item)).isEqualByComparingTo("-10");
            assertThat(post(PATH + "/" + last + "/confirm", token, body()).getStatusCode().value()).isEqualTo(409);
            assertThat(post(PATH + "/" + last + "/cancel", token, body()).getStatusCode().value()).isEqualTo(409);
        } finally { cleanup(f); }
    }

    @Test void draft_edit_recalculates_amount_cancel_releases_order_allocation_and_preserves_history() {
        var f = fixture("EDIT"); var t = loginAdmin();
        try {
            long id = create(f, 6, t);
            assertThat(post(PATH, t, input(f, 5)).getStatusCode().value()).isEqualTo(422);
            var r = rest.exchange(PATH + "/" + id, HttpMethod.PATCH, authEntity(t, body("qty", 4.5, "vehicle", "차량", "trackingNo", "송장")), JsonNode.class);
            assertThat(r.getStatusCode().value()).isEqualTo(200); assertThat(r.getBody().path("amount").asLong()).isEqualTo(45);
            assertThat(rest.exchange(PATH + "/" + id, HttpMethod.PATCH, authEntity(t, body()), JsonNode.class).getStatusCode().value()).isEqualTo(400);
            assertThat(rest.exchange(PATH + "/" + id, HttpMethod.DELETE, authEntity(t, null), JsonNode.class).getStatusCode().value()).isEqualTo(409);
            assertThat(post(PATH + "/" + id + "/confirm", t, body()).getStatusCode().value()).isEqualTo(409);
            assertThat(post(PATH + "/" + id + "/cancel", t, body()).getStatusCode().value()).isEqualTo(200);
            assertThat(get(PATH + "/" + id, t).getBody().path("status").asText()).isEqualTo("취소");
            create(f, 10, t); assertThat(stock(f)).isEqualByComparingTo("10");
        } finally { cleanup(f); }
    }

    @Test void rejects_bad_quantities_terminal_orders_wrong_held_expired_lots_and_insufficient_stock() {
        var f = fixture("RULES"); var t = loginAdmin();
        try {
            for (var changes : List.of(body("qty", 0), body("qty", -1), body("qty", 0.00001), body("lotId", 0), body("vehicle", "a".repeat(65)), body("trackingNo", "a".repeat(65)))) {
                var input = input(f, 1); input.putAll(changes); assertThat(post(PATH, t, input).getStatusCode().value()).isEqualTo(400);
            }
            var wrong = input(f, 1); wrong.put("lotId", 1); assertThat(post(PATH, t, wrong).getStatusCode().value()).isEqualTo(422);
            for (String state : List.of("대기", "취소", "출하완료")) {
                jdbc.update("update sales_orders set status=? where id=?", state, f.order);
                assertThat(post(PATH, t, input(f, 1)).getStatusCode().value()).isEqualTo(409);
            }
            jdbc.update("update sales_orders set status='확정' where id=?", f.order);
            for (String status : List.of("보류", "폐기")) {
                jdbc.update("update lots set status=? where id=?", status, f.lot);
                assertThat(post(PATH, t, input(f, 1)).getStatusCode().value()).isEqualTo(409);
            }
            jdbc.update("update lots set status='정상',expiry=current_date-1 where id=?", f.lot);
            assertThat(post(PATH, t, input(f, 1)).getStatusCode().value()).isEqualTo(409);
            jdbc.update("update lots set expiry=null where id=?", f.lot);
            long id = create(f, 6, t); dispatch(id, t);
            jdbc.update("update items set stock=5 where id=?", f.item);
            assertThat(post(PATH + "/" + id + "/confirm", t, body()).getStatusCode().value()).isEqualTo(422);
            jdbc.update("update items set stock=10 where id=?", f.item); jdbc.update("update lots set qty=5 where id=?", f.lot);
            assertThat(post(PATH + "/" + id + "/confirm", t, body()).getStatusCode().value()).isEqualTo(422);
            assertOrder(f, "확정"); assertThat(jdbc.queryForObject("select count(*) from receivables where sales_order_id=?", Integer.class, f.order)).isZero();
            assertThat(post(PATH + "/3/confirm", t, body()).getStatusCode().value()).isEqualTo(409);
        } finally { cleanup(f); }
    }

    @Test void sales_and_admin_can_write_other_roles_only_read_with_validated_search_and_sort() {
        var f = fixture("ROLES"); createUser("shipment-sales", "pw", "SALES"); createUser("shipment-material", "pw", "MATERIAL");
        var sales = login("shipment-sales", "pw"); var material = login("shipment-material", "pw");
        try {
            long id = create(f, 4, sales);
            assertThat(get(PATH + "?salesOrderId=" + f.order + "&itemId=" + f.item + "&keyword=T-SH-ROLES&sort=qty,asc&size=1", material).getBody().path("totalElements").asLong()).isEqualTo(1);
            assertThat(get(PATH + "/" + id, material).getStatusCode().value()).isEqualTo(200);
            for (String q : List.of("status=bad", "page=-1", "size=101", "sort=lot.qty,asc", "customerId=0", "salesOrderId=0", "itemId=0")) assertThat(get(PATH + "?" + q, sales).getStatusCode().value()).isEqualTo(400);
            assertThat(get(PATH + "?keyword=%25", material).getBody().path("totalElements").asLong()).isZero();
            assertThat(post(PATH, material, input(f, 1)).getStatusCode().value()).isEqualTo(403);
            for (String action : List.of("dispatch", "depart", "confirm", "cancel")) assertThat(post(PATH + "/" + id + "/" + action, material, body()).getStatusCode().value()).isEqualTo(403);
            dispatch(id, sales); assertThat(post(PATH + "/" + id + "/confirm", sales, body()).getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(f); }
    }

    @Test void concurrent_order_allocations_and_duplicate_confirm_are_serialized() throws Exception {
        var f = fixture("RACE"); var t = loginAdmin();
        try {
            var start = new CountDownLatch(1);
            var a = CompletableFuture.supplyAsync(() -> { await(start); return post(PATH, t, input(f, 6)).getStatusCode().value(); });
            var b = CompletableFuture.supplyAsync(() -> { await(start); return post(PATH, t, input(f, 6)).getStatusCode().value(); });
            start.countDown(); assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 422);
            long id = jdbc.queryForObject("select id from shipments where sales_order_id=?", Long.class, f.order); dispatch(id, t);
            var gate = new CountDownLatch(1);
            var c = CompletableFuture.supplyAsync(() -> { await(gate); return post(PATH + "/" + id + "/confirm", t, body()).getStatusCode().value(); });
            var d = CompletableFuture.supplyAsync(() -> { await(gate); return post(PATH + "/" + id + "/confirm", t, body()).getStatusCode().value(); });
            gate.countDown(); assertThat(List.of(c.get(30, TimeUnit.SECONDS), d.get(30, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
            assertThat(stock(f)).isEqualByComparingTo("4"); assertThat(lotQty(f)).isEqualByComparingTo("4");
        } finally { cleanup(f); }
    }

    @Test void concurrent_different_orders_cannot_oversell_same_item_and_lot() throws Exception {
        var f = fixture("SHARED"); var t = loginAdmin(); long other = order("SHARED-OTHER", f.item);
        try {
            long a = create(f, 6, t), b = create(new Fixture(f.item, other, f.lot), 6, t); dispatch(a, t); dispatch(b, t);
            var gate = new CountDownLatch(1);
            var x = CompletableFuture.supplyAsync(() -> { await(gate); return post(PATH + "/" + a + "/confirm", t, body()).getStatusCode().value(); });
            var y = CompletableFuture.supplyAsync(() -> { await(gate); return post(PATH + "/" + b + "/confirm", t, body()).getStatusCode().value(); });
            gate.countDown(); assertThat(List.of(x.get(30, TimeUnit.SECONDS), y.get(30, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 422);
            assertThat(stock(f)).isEqualByComparingTo("4"); assertThat(lotQty(f)).isEqualByComparingTo("4");
        } finally { cleanup(f); }
    }

    @Test void audit_failure_rolls_back_all_confirmation_changes() {
        var f = fixture("ROLLBACK"); var t = loginAdmin();
        try {
            long id = create(f, 10, t); dispatch(id, t);
            jdbc.execute("CREATE FUNCTION reject_shipment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.trace_id='sh-rollback' THEN RAISE EXCEPTION 'audit rejected'; END IF; RETURN NEW; END $$");
            jdbc.execute("CREATE TRIGGER reject_shipment_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_shipment_audit()");
            assertThat(post(PATH + "/" + id + "/confirm", t, body(), "sh-rollback").getStatusCode().value()).isEqualTo(500);
            assertThat(stock(f)).isEqualByComparingTo("10"); assertThat(lotQty(f)).isEqualByComparingTo("10"); assertOrder(f, "확정");
            var row = get(PATH + "/" + id, t).getBody(); assertThat(row.path("status").asText()).isEqualTo("배차"); assertThat(row.hasNonNull("inventoryTxnNo")).isFalse();
            assertThat(jdbc.queryForObject("select count(*) from receivables where sales_order_id=?", Integer.class, f.order)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where item_id=?", Integer.class, f.item)).isZero();
        } finally { jdbc.execute("DROP TRIGGER IF EXISTS reject_shipment_audit ON audit_logs"); jdbc.execute("DROP FUNCTION IF EXISTS reject_shipment_audit()"); cleanup(f); }
    }

    @Test void quotation_to_production_lot_to_shipment_and_receivable_is_traceable_end_to_end() {
        var f = fixture("E2E"); var t = loginAdmin();
        try {
            jdbc.update("update items set stock=0 where id=?", f.item);
            var quote = post("/api/core/quotations", t, body("quotationNo", "T-SH-E2E", "customerId", 1, "itemId", f.item,
                    "qty", 10, "unitPrice", 100, "dueDate", today().plusDays(10), "validUntil", today().plusDays(10)));
            assertThat(quote.getStatusCode().value()).isEqualTo(201); long qid = quote.getBody().path("id").asLong();
            assertThat(post("/api/core/quotations/" + qid + "/send", t, body()).getStatusCode().value()).isEqualTo(200);
            var sale = post("/api/core/sales-orders/from-quotation/" + qid, t, body()); assertThat(sale.getStatusCode().value()).isEqualTo(201);
            long so = sale.getBody().path("id").asLong();
            var confirmed = post("/api/core/sales-orders/" + so + "/confirm", t, body()); assertThat(confirmed.getStatusCode().value()).isEqualTo(200);
            long wo = confirmed.getBody().path("workOrderId").asLong();
            var completed = post("/api/core/work-orders/" + wo + "/complete", t, body("goodQty", 10, "defectQty", 0));
            assertThat(completed.getStatusCode().value()).isEqualTo(200);
            String lotNo = completed.getBody().path("lotNo").asText();
            long lot = jdbc.queryForObject("select id from lots where lot_no=?", Long.class, lotNo);
            long sh = create(new Fixture(f.item, so, lot), 10, t); dispatch(sh, t);
            var shipped = post(PATH + "/" + sh + "/confirm", t, body()); assertThat(shipped.getStatusCode().value()).isEqualTo(200);
            assertThat(shipped.getBody().path("shipment").path("lotNo").asText()).isEqualTo(lotNo);
            assertThat(jdbc.queryForObject("select amount from receivables where sales_order_id=?", Long.class, so)).isEqualTo(1000L);
            assertThat(jdbc.queryForObject("select sum(qty) from inventory_transactions where item_id=?", BigDecimal.class, f.item)).isZero();
            assertThat(stock(f)).isZero(); assertThat(jdbc.queryForObject("select qty from lots where id=?", BigDecimal.class, lot)).isZero();
            assertThat(get("/api/core/sales-orders/" + so, t).getBody().path("quotationId").asLong()).isEqualTo(qid);
        } finally { cleanup(f); }
    }

    private record Fixture(long item, long order, long lot) {}
    private Fixture fixture(String suffix) {
        long item = jdbc.queryForObject("insert into items(item_no,name,item_type,spec,unit,price,safety_stock,stock,lead_time_days) values (?,'출하테스트','제품','','EA',10,0,10,0) returning id", Long.class, "T-SH-" + suffix);
        long order = order(suffix, item);
        long lot = jdbc.queryForObject("insert into lots(lot_no,item_id,warehouse,qty,produced_at,status) values (?,?,'완제품창고',10,current_date,'정상') returning id", Long.class, "T-SH-" + suffix, item);
        return new Fixture(item, order, lot);
    }
    private long order(String suffix, long item) { return jdbc.queryForObject("insert into sales_orders(sales_order_no,customer_id,item_id,qty,unit_price,amount,due_date,ordered_at,status,payment_terms,lead_time_days) values (?,1,?,10,10,103,current_date,current_date,'확정',7,0) returning id", Long.class, "T-SH-" + suffix, item); }
    private java.util.Map<String, Object> input(Fixture f, double qty) { return body("salesOrderId", f.order, "lotId", f.lot, "qty", qty, "deliveryDate", "2026-12-31"); }
    private long create(Fixture f, double qty, String t) { var r = post(PATH, t, input(f, qty)); assertThat(r.getStatusCode().value()).isEqualTo(201); return r.getBody().path("id").asLong(); }
    private void dispatch(long id, String t) { assertThat(post(PATH + "/" + id + "/dispatch", t, body()).getStatusCode().value()).isEqualTo(200); }
    private BigDecimal stock(Fixture f) { return jdbc.queryForObject("select stock from items where id=?", BigDecimal.class, f.item); }
    private BigDecimal lotQty(Fixture f) { return jdbc.queryForObject("select qty from lots where id=?", BigDecimal.class, f.lot); }
    private void assertOrder(Fixture f, String s) { assertThat(jdbc.queryForObject("select status from sales_orders where id=?", String.class, f.order)).isEqualTo(s); }
    private void assertAudits(String trace) { assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc(trace)).hasSize(6).allSatisfy(a -> { assertThat(a.getActorId()).isNotNull(); assertThat(a.getAfterJson()).isNotNull(); }); }
    private LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }
    private void await(CountDownLatch gate) { try { gate.await(10, TimeUnit.SECONDS); } catch (InterruptedException e) { throw new RuntimeException(e); } }
    private void cleanup(Fixture f) {
        jdbc.update("delete from shipments where item_id=?", f.item);
        jdbc.update("delete from receivables where sales_order_id in (select id from sales_orders where item_id=?)", f.item);
        jdbc.update("delete from inventory_transactions where item_id=?", f.item); jdbc.update("delete from lots where item_id=?", f.item);
        jdbc.update("delete from work_orders where item_id=?", f.item); jdbc.update("delete from sales_orders where item_id=?", f.item);
        jdbc.update("delete from quotations where item_id=?", f.item); jdbc.update("delete from items where id=?", f.item);
    }
}
