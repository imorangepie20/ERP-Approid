package com.erpapproid.core.api.production;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class WorkOrderMaterialIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/work-orders";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void issues_deduct_lot_and_stock_and_requirements_reflect_net() {
        String token = loginAdmin();
        long product = item("T-WO-MT-P1", "제품", 0);
        long material = item("T-WO-MT-M1", "자재", 100);
        long lot = lot(material, "T-WO-MT-L1", 100);
        bom("T-WO-MT-B1", product, material, 2, 25);
        long wo = wo("T-WO-MT-W1", product, token);
        try {
            var req = get(PATH + "/" + wo + "/materials", token).getBody();
            assertThat(req.path("requirements").size()).isEqualTo(1);
            var row = req.path("requirements").get(0);
            assertThat(row.path("childItemId").asLong()).isEqualTo(material);
            assertThat(row.path("requiredQty").decimalValue()).isEqualByComparingTo("25");
            assertThat(row.path("netIssuedQty").decimalValue()).isEqualByComparingTo("0");
            assertThat(row.path("remainingQty").decimalValue()).isEqualByComparingTo("25");
            var issued = post(PATH + "/" + wo + "/material-issues", token,
                    body("childItemId", material, "lotId", lot, "qty", 10), "wo-mat-issue").getBody();
            assertThat(issued.path("qty").decimalValue()).isEqualByComparingTo("10");
            assertThat(issued.path("remainingQty").decimalValue()).isEqualByComparingTo("15");
            assertThat(lotQty(lot)).isEqualByComparingTo("90");
            assertThat(stock(material)).isEqualByComparingTo("90");
            assertThat(jdbc.queryForObject("select sum(qty) from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ? and txn_type = '출고'",
                    BigDecimal.class, "T-WO-MT-W1")).isEqualByComparingTo("-10");
            var after = get(PATH + "/" + wo + "/materials", token).getBody();
            assertThat(after.path("requirements").get(0).path("netIssuedQty").decimalValue()).isEqualByComparingTo("10");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("wo-mat-issue")).hasSize(4);
        } finally { cleanup(wo, product, material); }
    }

    @Test
    void returns_restore_lot_and_stock_and_cap_at_net_issued() {
        String token = loginAdmin();
        long product = item("T-WO-MT-P2", "제품", 0);
        long material = item("T-WO-MT-M2", "자재", 100);
        long lot = lot(material, "T-WO-MT-L2", 100);
        bom("T-WO-MT-B2", product, material, 2, 25);
        long wo = wo("T-WO-MT-W2", product, token);
        try {
            post(PATH + "/" + wo + "/material-issues", token, body("childItemId", material, "lotId", lot, "qty", 10));
            var returned = post(PATH + "/" + wo + "/material-returns", token,
                    body("childItemId", material, "lotId", lot, "qty", 4), "wo-mat-return").getBody();
            assertThat(returned.path("qty").decimalValue()).isEqualByComparingTo("4");
            assertThat(lotQty(lot)).isEqualByComparingTo("94");
            assertThat(stock(material)).isEqualByComparingTo("94");
            error(post(PATH + "/" + wo + "/material-returns", token, body("childItemId", material, "lotId", lot, "qty", 7)), 422, "BUSINESS_RULE_VIOLATION");
            assertThat(lotQty(lot)).isEqualByComparingTo("94");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("wo-mat-return")).hasSize(4);
        } finally { cleanup(wo, product, material); }
    }

    @Test
    void rejects_over_issue_insufficient_and_missing_bom() {
        String token = loginAdmin();
        long product = item("T-WO-MT-P3", "제품", 0);
        long material = item("T-WO-MT-M3", "자재", 12);
        long lot = lot(material, "T-WO-MT-L3", 12);
        bom("T-WO-MT-B3", product, material, 2, 25);
        long wo = wo("T-WO-MT-W3", product, token);
        long bare = item("T-WO-MT-P4", "제품", 0);
        long bareWo = wo("T-WO-MT-W4", bare, token);
        try {
            error(post(PATH + "/" + wo + "/material-issues", token, body("childItemId", material, "lotId", lot, "qty", 26)), 422, "BUSINESS_RULE_VIOLATION");
            error(post(PATH + "/" + wo + "/material-issues", token, body("childItemId", material, "lotId", lot, "qty", 13)), 422, "INSUFFICIENT_STOCK");
            error(post(PATH + "/" + wo + "/material-issues", token, body("childItemId", 999999L, "lotId", lot, "qty", 1)), 404, "BOM_NOT_FOUND");
            error(post(PATH + "/" + bareWo + "/material-issues", token, body("childItemId", material, "lotId", lot, "qty", 1)), 404, "BOM_NOT_FOUND");
            error(post(PATH + "/" + wo + "/material-issues", token, body("childItemId", material, "lotId", lot, "qty", 0)), 400, "INVALID_INPUT");
            assertThat(lotQty(lot)).isEqualByComparingTo("12");
            assertThat(stock(material)).isEqualByComparingTo("12");
        } finally { cleanup(wo, product, material); cleanup(bareWo, bare, null); }
    }

    @Test
    void blocks_terminal_orders_and_enforces_production_role() {
        createUser("wo-mat-production", "password123", "PRODUCTION");
        createUser("wo-mat-sales", "password123", "SALES");
        String production = login("wo-mat-production", "password123");
        String sales = login("wo-mat-sales", "password123");
        String token = loginAdmin();
        long product = item("T-WO-MT-P5", "제품", 0);
        long material = item("T-WO-MT-M5", "자재", 100);
        long lot = lot(material, "T-WO-MT-L5", 100);
        bom("T-WO-MT-B5", product, material, 1, 0);
        long wo = wo("T-WO-MT-W5", product, token);
        try {
            error(post(PATH + "/" + wo + "/material-issues", sales, body("childItemId", material, "lotId", lot, "qty", 1)), 403, "FORBIDDEN");
            error(post(PATH + "/" + wo + "/material-issues", body("childItemId", material, "lotId", lot, "qty", 1)), 401, "UNAUTHORIZED");
            error(post(PATH + "/999999/material-issues", production, body("childItemId", material, "lotId", lot, "qty", 1)), 404, "WORK_ORDER_NOT_FOUND");
            assertThat(post(PATH + "/" + wo + "/material-issues", production, body("childItemId", material, "lotId", lot, "qty", 2)).getStatusCode().value()).isEqualTo(201);
            post(PATH + "/" + wo + "/complete", token, body("goodQty", 8, "defectQty", 2));
            post(PATH + "/" + wo + "/close", token, body());
            error(post(PATH + "/" + wo + "/material-issues", token, body("childItemId", material, "lotId", lot, "qty", 1)), 409, "INVALID_STATE_TRANSITION");
            error(post(PATH + "/" + wo + "/material-returns", token, body("childItemId", material, "lotId", lot, "qty", 1)), 409, "INVALID_STATE_TRANSITION");
        } finally { cleanup(wo, product, material); }
    }

    @Test
    void audit_failure_rolls_back_issue_stock_lot_and_transaction() {
        String token = loginAdmin();
        long product = item("T-WO-MT-P6", "제품", 0);
        long material = item("T-WO-MT-M6", "자재", 100);
        long lot = lot(material, "T-WO-MT-L6", 100);
        bom("T-WO-MT-B6", product, material, 1, 0);
        long wo = wo("T-WO-MT-W6", product, token);
        jdbc.execute("create function test_reject_wo_mat_audit() returns trigger language plpgsql as $$ begin if NEW.trace_id = 'wo-mat-rollback' then raise exception 'test audit rejection'; end if; return NEW; end $$");
        jdbc.execute("create trigger test_reject_wo_mat_audit before insert on audit_logs for each row execute function test_reject_wo_mat_audit()");
        try {
            assertThat(post(PATH + "/" + wo + "/material-issues", token,
                    body("childItemId", material, "lotId", lot, "qty", 5), "wo-mat-rollback").getStatusCode().value()).isEqualTo(500);
            assertThat(lotQty(lot)).isEqualByComparingTo("100");
            assertThat(stock(material)).isEqualByComparingTo("100");
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ?",
                    Long.class, "T-WO-MT-W6")).isZero();
        } finally {
            jdbc.execute("drop trigger test_reject_wo_mat_audit on audit_logs");
            jdbc.execute("drop function test_reject_wo_mat_audit()");
            cleanup(wo, product, material);
        }
    }

    private long item(String no, String type, int stock) {
        return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'불출 검증','" + type + "','EA',100,?,0,0) returning id",
                Long.class, no, stock);
    }

    private long lot(long item, String no, int qty) {
        return jdbc.queryForObject("insert into lots(lot_no,item_id,warehouse,qty,produced_at,status) values (?,?,'자재창고',?,current_date,'정상') returning id",
                Long.class, no, item, qty);
    }

    private void bom(String no, long parent, long child, int qty, int loss) {
        jdbc.update("insert into boms(bom_no,parent_id,child_id,qty,loss_rate) values (?,?,?,?,?)", no, parent, child, qty, loss);
    }

    private long wo(String no, long product, String token) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        var response = post(PATH, token, body("workOrderNo", no, "itemId", product, "qty", 10, "dueDate", today.plusDays(10).toString()));
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        return response.getBody().path("id").asLong();
    }

    private BigDecimal lotQty(long lot) { return jdbc.queryForObject("select qty from lots where id = ?", BigDecimal.class, lot); }
    private BigDecimal stock(long item) { return jdbc.queryForObject("select stock from items where id = ?", BigDecimal.class, item); }

    private void error(ResponseEntity<JsonNode> r, int status, String code) {
        assertThat(r.getStatusCode().value()).isEqualTo(status);
        assertThat(r.getBody().path("code").asText()).isEqualTo(code);
    }

    private void cleanup(Long wo, Long product, Long material) {
        if (wo != null) {
            String no = jdbc.queryForObject("select work_order_no from work_orders where id = ?", String.class, wo);
            jdbc.update("delete from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ?", no);
            jdbc.update("delete from work_orders where id = ?", wo);
        }
        if (product != null && material != null) jdbc.update("delete from boms where parent_id = ? and child_id = ?", product, material);
        if (material != null) {
            jdbc.update("delete from lots where item_id = ?", material);
            jdbc.update("delete from items where id = ?", material);
        }
        if (product != null) {
            jdbc.update("delete from lots where item_id = ?", product);
            jdbc.update("delete from items where id = ?", product);
        }
    }
}
