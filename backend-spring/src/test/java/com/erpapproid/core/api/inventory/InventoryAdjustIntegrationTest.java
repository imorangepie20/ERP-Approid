package com.erpapproid.core.api.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class InventoryAdjustIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/inventory/adjustments";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void adjusts_stock_to_counted_quantity_with_ledger_delta_transaction() {
        String token = loginAdmin(); long item = item("T-ADJ-BASIC", 100);
        try {
            var body = post(PATH, token, adjust(item, 130, "자재창고", "월말 실사"), "inv-adj-basic").getBody();
            assertThat(body.path("previousStock").asDouble()).isEqualTo(100.0);
            assertThat(body.path("ledgerBalance").asDouble()).isEqualTo(0.0);
            assertThat(body.path("countedQty").asDouble()).isEqualTo(130.0);
            assertThat(body.path("adjustedQty").asDouble()).isEqualTo(130.0);
            assertThat(body.path("txnType").asText()).isEqualTo("실사");
            assertThat(body.path("txnNo").asText()).startsWith("IVT-");
            assertThat(stock(item)).isEqualByComparingTo("130");
            assertThat(jdbc.queryForObject("select sum(qty) from inventory_transactions where item_id = ?", BigDecimal.class, item)).isEqualByComparingTo("130");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("inv-adj-basic")).hasSize(2);
        } finally { cleanup(item); }
    }

    @Test
    void nets_existing_ledger_without_touching_past_sources() {
        String token = loginAdmin(); long item = item("T-ADJ-LEDGER", 100);
        jdbc.update("insert into inventory_transactions(txn_no,item_id,warehouse,txn_type,qty,txn_date) values ('T-ADJ-PRIOR',?,'자재창고','입고',40,current_date)", item);
        try {
            var body = post(PATH, token, adjust(item, 130, "자재창고", "수불 누락분 반영"), "inv-adj-ledger").getBody();
            assertThat(body.path("ledgerBalance").asDouble()).isEqualTo(40.0);
            assertThat(body.path("adjustedQty").asDouble()).isEqualTo(90.0);
            assertThat(stock(item)).isEqualByComparingTo("130");
            assertThat(jdbc.queryForObject("select qty from inventory_transactions where txn_no = 'T-ADJ-PRIOR'", BigDecimal.class)).isEqualByComparingTo("40");
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where item_id = ?", Long.class, item)).isEqualTo(2);
        } finally { cleanup(item); }
    }

    @Test
    void rejects_zero_delta_and_invalid_input() {
        String token = loginAdmin(); long item = item("T-ADJ-INVALID", 100);
        try {
            error(post(PATH, token, adjust(item, 0, "자재창고", "차이 없음"), "inv-adj-zero"), 422, "BUSINESS_RULE_VIOLATION");
            assertThat(stock(item)).isEqualByComparingTo("100");
            error(post(PATH, token, adjust(item, -5, "자재창고", "음수 불가")), 400, "INVALID_INPUT");
            error(post(PATH, token, adjust(item, 10, "", "창고 필요")), 400, "INVALID_INPUT");
            error(post(PATH, token, adjust(item, 10, "자재창고", "")), 400, "INVALID_INPUT");
            error(post(PATH, token, adjust(item, 10, "자재창고", "x".repeat(201))), 400, "INVALID_INPUT");
            error(post(PATH, token, adjust(999999999L, 10, "자재창고", "품목 없음")), 404, "ITEM_NOT_FOUND");
            error(post(PATH, token, adjust(0L, 10, "자재창고", "품목 없음")), 400, "INVALID_INPUT");
        } finally { cleanup(item); }
    }

    @Test
    void audit_failure_rolls_back_stock_and_transaction() {
        String token = loginAdmin(); long item = item("T-ADJ-ROLLBACK", 100);
        jdbc.execute("create function test_reject_adjust_audit() returns trigger language plpgsql as $$ begin if NEW.trace_id = 'inv-adj-rollback' then raise exception 'test audit rejection'; end if; return NEW; end $$");
        jdbc.execute("create trigger test_reject_adjust_audit before insert on audit_logs for each row execute function test_reject_adjust_audit()");
        try {
            assertThat(post(PATH, token, adjust(item, 130, "자재창고", "롤백 검증"), "inv-adj-rollback").getStatusCode().value()).isEqualTo(500);
            assertThat(stock(item)).isEqualByComparingTo("100");
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where item_id = ?", Long.class, item)).isZero();
        } finally {
            jdbc.execute("drop trigger test_reject_adjust_audit on audit_logs");
            jdbc.execute("drop function test_reject_adjust_audit()");
            cleanup(item);
        }
    }

    @Test
    void enforces_material_role() {
        createUser("adj-material", "password123", "MATERIAL");
        createUser("adj-sales", "password123", "SALES");
        String material = login("adj-material", "password123");
        String sales = login("adj-sales", "password123");
        long item = item("T-ADJ-ROLE", 100);
        try {
            error(post(PATH, sales, adjust(item, 130, "자재창고", "권한 없음")), 403, "FORBIDDEN");
            error(post(PATH, adjust(item, 130, "자재창고", "익명")), 401, "UNAUTHORIZED");
            assertThat(post(PATH, material, adjust(item, 130, "자재창고", "월말 실사")).getStatusCode().value()).isEqualTo(201);
        } finally { cleanup(item); }
    }

    private long item(String no, int stock) { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'조정 검증 자재','자재','KG',100,?,0,0) returning id", Long.class, no, stock); }
    private java.util.Map<String, Object> adjust(long item, double counted, String warehouse, String reason) { return body("itemId", item, "countedQty", counted, "warehouse", warehouse, "reason", reason); }
    private BigDecimal stock(long item) { return jdbc.queryForObject("select stock from items where id = ?", BigDecimal.class, item); }
    private void error(ResponseEntity<JsonNode> r, int status, String code) { assertThat(r.getStatusCode().value()).isEqualTo(status); assertThat(r.getBody().path("code").asText()).isEqualTo(code); }
    private void cleanup(long item) {
        jdbc.update("delete from inventory_transactions where item_id = ?", item);
        jdbc.update("delete from items where id = ?", item);
    }
}
