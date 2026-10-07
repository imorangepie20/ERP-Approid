package com.erpapproid.core.api.production;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class WorkOrderOperationIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/work-orders";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void starts_and_completes_steps_sequentially_with_header_reconciliation() {
        String token = loginAdmin();
        long wo = wo("T-WO-OP-W1", 1, token);
        try {
            var ops = get(PATH + "/" + wo + "/operations", token).getBody();
            assertThat(ops.path("steps").size()).isEqualTo(3);
            assertThat(ops.path("matched").asBoolean()).isFalse();
            assertThat(ops.path("steps").get(0).path("opStatus").asText()).isEqualTo("대기");
            post(PATH + "/" + wo + "/progress", token, body("goodQty", 6, "defectQty", 4));
            error(post(PATH + "/" + wo + "/operations/20/start", token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(op(PATH + "/" + wo + "/operations/10/start", token, body(), "wo-op-start").path("opStatus").asText()).isEqualTo("진행중");
            assertThat(get(PATH + "/" + wo, token).getBody().path("status").asText()).isEqualTo("진행중");
            var done = op(PATH + "/" + wo + "/operations/10/complete", token, body("goodQty", 6, "defectQty", 4), "wo-op-done");
            assertThat(done.path("opStatus").asText()).isEqualTo("완료");
            op(PATH + "/" + wo + "/operations/20/start", token, body());
            op(PATH + "/" + wo + "/operations/20/complete", token, body("goodQty", 0, "defectQty", 0));
            op(PATH + "/" + wo + "/operations/30/start", token, body());
            op(PATH + "/" + wo + "/operations/30/complete", token, body("goodQty", 0, "defectQty", 0));
            var reconciled = get(PATH + "/" + wo + "/operations", token).getBody();
            assertThat(reconciled.path("sumGoodQty").decimalValue()).isEqualByComparingTo("6");
            assertThat(reconciled.path("sumDefectQty").decimalValue()).isEqualByComparingTo("4");
            assertThat(reconciled.path("matched").asBoolean()).isTrue();
            assertThat(post(PATH + "/" + wo + "/complete", token, body(), "wo-op-complete").getStatusCode().value()).isEqualTo(200);
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("wo-op-start")).hasSize(1);
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("wo-op-done")).hasSize(1);
        } finally { cleanup(wo); }
    }

    @Test
    void revises_completed_step_quantities_and_rejects_over_qty() {
        String token = loginAdmin();
        long wo = wo("T-WO-OP-W2", 1, token);
        try {
            post(PATH + "/" + wo + "/progress", token, body("goodQty", 6, "defectQty", 4));
            op(PATH + "/" + wo + "/operations/10/start", token, body());
            op(PATH + "/" + wo + "/operations/10/complete", token, body("goodQty", 5, "defectQty", 4));
            var revised = op(PATH + "/" + wo + "/operations/10/complete", token, body("goodQty", 6, "defectQty", 4));
            assertThat(revised.path("actualGoodQty").decimalValue()).isEqualByComparingTo("6");
            error(post(PATH + "/" + wo + "/operations/10/complete", token, body("goodQty", 7, "defectQty", 4)), 422, "WORK_ORDER_QTY_EXCEEDED");
            error(post(PATH + "/" + wo + "/operations/10/complete", token, body("goodQty", -1, "defectQty", 0)), 400, "INVALID_INPUT");
            error(post(PATH + "/" + wo + "/operations/10/start", token, body()), 409, "INVALID_STATE_TRANSITION");
        } finally { cleanup(wo); }
    }

    @Test
    void complete_requires_matched_operations_only_for_routed_orders() {
        String token = loginAdmin();
        long routed = wo("T-WO-OP-W3", 1, token);
        long bare = wo("T-WO-OP-W4", bareItem(), token);
        try {
            post(PATH + "/" + routed + "/progress", token, body("goodQty", 6, "defectQty", 4));
            error(post(PATH + "/" + routed + "/complete", token, body()), 422, "WORK_ORDER_QTY_MISMATCH");
            post(PATH + "/" + bare + "/progress", token, body("goodQty", 6, "defectQty", 4));
            assertThat(post(PATH + "/" + bare + "/complete", token, body()).getStatusCode().value()).isEqualTo(200);
            op(PATH + "/" + routed + "/operations/10/start", token, body());
            op(PATH + "/" + routed + "/operations/10/complete", token, body("goodQty", 6, "defectQty", 3));
            op(PATH + "/" + routed + "/operations/20/start", token, body());
            op(PATH + "/" + routed + "/operations/20/complete", token, body("goodQty", 0, "defectQty", 0));
            op(PATH + "/" + routed + "/operations/30/start", token, body());
            op(PATH + "/" + routed + "/operations/30/complete", token, body("goodQty", 0, "defectQty", 0));
            error(post(PATH + "/" + routed + "/complete", token, body()), 422, "WORK_ORDER_QTY_MISMATCH");
        } finally { cleanup(routed); cleanup(bare); }
    }

    @Test
    void enforces_production_role_and_step_existence() {
        createUser("wo-op-production", "password123", "PRODUCTION");
        createUser("wo-op-sales", "password123", "SALES");
        String production = login("wo-op-production", "password123");
        String sales = login("wo-op-sales", "password123");
        String token = loginAdmin();
        long wo = wo("T-WO-OP-W5", 1, token);
        try {
            error(post(PATH + "/" + wo + "/operations/10/start", sales, body()), 403, "FORBIDDEN");
            error(post(PATH + "/" + wo + "/operations/10/start", body()), 401, "UNAUTHORIZED");
            error(get(PATH + "/999999/operations", production), 404, "WORK_ORDER_NOT_FOUND");
            error(post(PATH + "/" + wo + "/operations/99/start", production, body()), 404, "NOT_FOUND");
            assertThat(post(PATH + "/" + wo + "/operations/10/start", production, body()).getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(wo); }
    }

    @Test
    void audit_failure_rolls_back_operation_start() {
        String token = loginAdmin();
        long wo = wo("T-WO-OP-W6", 1, token);
        jdbc.execute("create function test_reject_wo_op_audit() returns trigger language plpgsql as $$ begin if NEW.trace_id = 'wo-op-rollback' then raise exception 'test audit rejection'; end if; return NEW; end $$");
        jdbc.execute("create trigger test_reject_wo_op_audit before insert on audit_logs for each row execute function test_reject_wo_op_audit()");
        try {
            assertThat(post(PATH + "/" + wo + "/operations/10/start", token, body(), "wo-op-rollback").getStatusCode().value()).isEqualTo(500);
            var ops = get(PATH + "/" + wo + "/operations", token).getBody();
            assertThat(ops.path("steps").get(0).path("opStatus").asText()).isEqualTo("대기");
            assertThat(get(PATH + "/" + wo, token).getBody().path("status").asText()).isEqualTo("지시");
        } finally {
            jdbc.execute("drop trigger test_reject_wo_op_audit on audit_logs");
            jdbc.execute("drop function test_reject_wo_op_audit()");
            cleanup(wo);
        }
    }

    private long wo(String no, long item, String token) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        var response = post(PATH, token, body("workOrderNo", no, "itemId", item, "qty", 10, "dueDate", today.plusDays(10).toString()));
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        return response.getBody().path("id").asLong();
    }

    private long bareItem() {
        return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values ('T-WO-OP-BARE','공정 검증 제품','제품','EA',100,0,0,0) returning id", Long.class);
    }

    private JsonNode op(String path, String token, Object request) {
        var r = post(path, token, request);
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        return r.getBody();
    }

    private JsonNode op(String path, String token, Object request, String trace) {
        var r = post(path, token, request, trace);
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        return r.getBody();
    }

    private void error(ResponseEntity<JsonNode> r, int status, String code) {
        assertThat(r.getStatusCode().value()).isEqualTo(status);
        assertThat(r.getBody().path("code").asText()).isEqualTo(code);
    }

    private void cleanup(long wo) {
        String no;
        try { no = jdbc.queryForObject("select work_order_no from work_orders where id = ?", String.class, wo); }
        catch (Exception e) { return; }
        Long product = jdbc.queryForObject("select item_id from work_orders where id = ?", Long.class, wo);
        BigDecimal good = jdbc.queryForObject("select good_qty from work_orders where id = ?", BigDecimal.class, wo);
        var lotIds = jdbc.queryForList("select lot_id from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ? and lot_id is not null", Long.class, no);
        jdbc.update("delete from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ?", no);
        for (Long lotId : lotIds) jdbc.update("delete from lots where id = ?", lotId);
        jdbc.update("delete from work_orders where id = ?", wo);
        String itemNo = jdbc.queryForObject("select item_no from items where id = ?", String.class, product);
        if (itemNo.startsWith("T-WO-OP-")) {
            jdbc.update("delete from lots where item_id = ?", product);
            jdbc.update("delete from items where id = ?", product);
        } else if (good.signum() != 0) {
            jdbc.update("update items set stock = stock - ? where id = ?", good, product);
        }
    }
}
