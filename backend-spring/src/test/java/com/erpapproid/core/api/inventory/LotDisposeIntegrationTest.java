package com.erpapproid.core.api.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class LotDisposeIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/lots";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void dispose_zeroes_lot_and_stock_with_compensation_transaction() {
        String token = loginAdmin(); long item = item("T-DISP-BASIC", 100);
        long lot = lot(item, "T-DISP-BASIC", 30);
        try {
            var result = post(PATH + "/" + lot + "/dispose", token, body(), "lot-dispose-basic");
            assertThat(result.getStatusCode().value()).isEqualTo(200);
            assertThat(result.getBody().path("status").asText()).isEqualTo("폐기");
            assertThat(result.getBody().path("qty").asText()).isEqualTo("0");
            assertThat(lotQty(lot)).isEqualByComparingTo("0");
            assertThat(lotStatus(lot)).isEqualTo("폐기");
            assertThat(stock(item)).isEqualByComparingTo("70");
            assertThat(jdbc.queryForObject("select qty from inventory_transactions where lot_id = ?", BigDecimal.class, lot)).isEqualByComparingTo("-30");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("lot-dispose-basic")).hasSize(2);
        } finally { cleanup(item); }
    }

    @Test
    void duplicate_dispose_is_rejected_without_extra_compensation() {
        String token = loginAdmin(); long item = item("T-DISP-DUP", 100);
        long lot = lot(item, "T-DISP-DUP", 30);
        try {
            assertThat(post(PATH + "/" + lot + "/dispose", token, body()).getStatusCode().value()).isEqualTo(200);
            error(post(PATH + "/" + lot + "/dispose", token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(stock(item)).isEqualByComparingTo("70");
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where lot_id = ?", Long.class, lot)).isEqualTo(1);
        } finally { cleanup(item); }
    }

    @Test
    void dispose_blocked_by_open_shipment_allocation_but_not_cancelled_ones() {
        String token = loginAdmin(); long item = item("T-DISP-SHIP", 100);
        long lot = lot(item, "T-DISP-SHIP", 30);
        long order = jdbc.queryForObject("insert into sales_orders(sales_order_no,customer_id,item_id,qty,unit_price,amount,due_date,status,ordered_at) values(?,1,?,10,100,1000,current_date,'확정',current_date) returning id",
                Long.class, key("T-DISP-SO-"), item);
        try {
            jdbc.update("insert into shipments(shipment_no,sales_order_id,customer_id,item_id,lot_id,qty,amount,delivery_date,status) values(?,?,1,?,?,10,1000,current_date,'배차')",
                    key("T-DISP-SH-"), order, item, lot);
            error(post(PATH + "/" + lot + "/dispose", token, body()), 409, "IN_USE");
            assertThat(lotStatus(lot)).isEqualTo("정상");
            assertThat(stock(item)).isEqualByComparingTo("100");
            jdbc.update("update shipments set status = '취소' where lot_id = ?", lot);
            assertThat(post(PATH + "/" + lot + "/dispose", token, body()).getStatusCode().value()).isEqualTo(200);
            assertThat(stock(item)).isEqualByComparingTo("70");
        } finally { cleanup(item); }
    }

    @Test
    void audit_failure_rolls_back_dispose_stock_and_compensation() {
        String token = loginAdmin(); long item = item("T-DISP-ROLLBACK", 100);
        long lot = lot(item, "T-DISP-ROLLBACK", 30);
        jdbc.execute("create function test_reject_lot_dispose_audit() returns trigger language plpgsql as $$ begin if NEW.trace_id = 'lot-dispose-rollback' then raise exception 'test audit rejection'; end if; return NEW; end $$");
        jdbc.execute("create trigger test_reject_lot_dispose_audit before insert on audit_logs for each row execute function test_reject_lot_dispose_audit()");
        try {
            assertThat(post(PATH + "/" + lot + "/dispose", token, body(), "lot-dispose-rollback").getStatusCode().value()).isEqualTo(500);
            assertThat(lotStatus(lot)).isEqualTo("정상");
            assertThat(lotQty(lot)).isEqualByComparingTo("30");
            assertThat(stock(item)).isEqualByComparingTo("100");
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where lot_id = ?", Long.class, lot)).isZero();
        } finally {
            jdbc.execute("drop trigger test_reject_lot_dispose_audit on audit_logs");
            jdbc.execute("drop function test_reject_lot_dispose_audit()");
            cleanup(item);
        }
    }

    @Test
    void enforces_quality_role_and_lot_existence() {
        createUser("disp-quality", "password123", "QUALITY");
        createUser("disp-sales", "password123", "SALES");
        String quality = login("disp-quality", "password123");
        String sales = login("disp-sales", "password123");
        long item = item("T-DISP-ROLE", 100);
        long lot = lot(item, "T-DISP-ROLE", 10);
        try {
            error(post(PATH + "/" + lot + "/dispose", sales, body()), 403, "FORBIDDEN");
            error(post(PATH + "/" + lot + "/dispose", body()), 401, "UNAUTHORIZED");
            error(post(PATH + "/999999999/dispose", quality, body()), 404, "LOT_NOT_FOUND");
            assertThat(post(PATH + "/" + lot + "/dispose", quality, body()).getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(item); }
    }

    private long item(String no, int stock) { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'폐기 검증 자재','자재','KG',100,?,0,0) returning id", Long.class, no, stock); }
    private long lot(long item, String no, int qty) { return jdbc.queryForObject("insert into lots(lot_no,item_id,warehouse,qty,produced_at,status) values (?,?,'자재창고',?,current_date,'정상') returning id", Long.class, no, item, qty); }
    private BigDecimal lotQty(long lot) { return jdbc.queryForObject("select qty from lots where id = ?", BigDecimal.class, lot); }
    private String lotStatus(long lot) { return jdbc.queryForObject("select status from lots where id = ?", String.class, lot); }
    private BigDecimal stock(long item) { return jdbc.queryForObject("select stock from items where id = ?", BigDecimal.class, item); }
    private String key(String prefix) { return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 8); }
    private void error(ResponseEntity<JsonNode> r, int status, String code) { assertThat(r.getStatusCode().value()).isEqualTo(status); assertThat(r.getBody().path("code").asText()).isEqualTo(code); }
    private void cleanup(long item) {
        jdbc.update("delete from shipments where item_id = ?", item);
        jdbc.update("delete from sales_orders where item_id = ?", item);
        jdbc.update("delete from inventory_transactions where item_id = ?", item);
        jdbc.update("delete from lots where item_id = ?", item);
        jdbc.update("delete from items where id = ?", item);
    }
}
