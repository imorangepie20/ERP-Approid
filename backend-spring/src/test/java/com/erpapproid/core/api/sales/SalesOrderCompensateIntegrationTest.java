package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class SalesOrderCompensateIntegrationTest extends IntegrationTestSupport {
    private static final String S = "/api/core/sales-orders";
    private static final String W = "/api/core/work-orders";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void cancels_confirmed_order_with_empty_work_order_preserving_history() {
        String token = loginAdmin();
        long sid = order("T-S-CMP-1", token);
        long wid = confirm(sid, token);
        try {
            var cancelled = post(S + "/" + sid + "/cancel", token, body(), "sales-cmp-cancel");
            assertThat(cancelled.getStatusCode().value()).isEqualTo(200);
            assertThat(cancelled.getBody().path("status").asText()).isEqualTo("취소");
            assertThat(get(S + "/" + sid, token).getBody().path("status").asText()).isEqualTo("취소");
            assertThat(get(W + "/" + wid, token).getBody().path("status").asText()).isEqualTo("취소");
            var logs = audits.findAllByTraceIdOrderByOccurredAtAsc("sales-cmp-cancel");
            assertThat(logs).hasSize(2);
            assertThat(logs).extracting(a -> a.getEntityType()).containsExactlyInAnyOrder("WORK_ORDER", "SALES_ORDER");
            error(post(S + "/" + sid + "/cancel", token, body()), 409, "INVALID_STATE_TRANSITION");
        } finally { cleanup(sid); }
    }

    @Test
    void blocks_progressed_work_order_material_moves_and_operations() {
        String token = loginAdmin();
        long sid = order("T-S-CMP-2", token);
        long wid = confirm(sid, token);
        try {
            post(W + "/" + wid + "/progress", token, body("goodQty", 1, "defectQty", 0));
            error(post(S + "/" + sid + "/cancel", token, body()), 409, "IN_USE");
            assertThat(get(S + "/" + sid, token).getBody().path("status").asText()).isEqualTo("확정");
            assertThat(get(W + "/" + wid, token).getBody().path("status").asText()).isEqualTo("진행중");
        } finally { cleanup(sid); }
    }

    @Test
    void blocks_open_and_confirmed_shipments() {
        String token = loginAdmin();
        long sid = order("T-S-CMP-3", token);
        confirm(sid, token);
        try {
            jdbc.update("insert into shipments(shipment_no,sales_order_id,customer_id,item_id,qty,amount,delivery_date,status) values(?,?,1,1,1,100,current_date,'지시')",
                    "T-S-CMP-SH3", sid);
            error(post(S + "/" + sid + "/cancel", token, body()), 409, "IN_USE");
            jdbc.update("update shipments set status = '취소' where sales_order_id = ?", sid);
            assertThat(post(S + "/" + sid + "/cancel", token, body()).getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(sid); }
    }

    @Test
    void enforces_sales_role_and_order_existence() {
        createUser("cmp-sales", "password123", "SALES");
        createUser("cmp-production", "password123", "PRODUCTION");
        String sales = login("cmp-sales", "password123");
        String production = login("cmp-production", "password123");
        String token = loginAdmin();
        long sid = order("T-S-CMP-4", token);
        confirm(sid, token);
        try {
            error(post(S + "/" + sid + "/cancel", production, body()), 403, "FORBIDDEN");
            error(post(S + "/" + sid + "/cancel", body()), 401, "UNAUTHORIZED");
            error(post(S + "/999999/cancel", sales, body()), 404, "SALES_ORDER_NOT_FOUND");
            assertThat(post(S + "/" + sid + "/cancel", sales, body()).getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(sid); }
    }

    @Test
    void audit_failure_rolls_back_order_and_work_order_cancel() {
        String token = loginAdmin();
        long sid = order("T-S-CMP-5", token);
        long wid = confirm(sid, token);
        jdbc.execute("create function test_reject_sales_cmp_audit() returns trigger language plpgsql as $$ begin if NEW.trace_id = 'sales-cmp-rollback' then raise exception 'test audit rejection'; end if; return NEW; end $$");
        jdbc.execute("create trigger test_reject_sales_cmp_audit before insert on audit_logs for each row execute function test_reject_sales_cmp_audit()");
        try {
            assertThat(post(S + "/" + sid + "/cancel", token, body(), "sales-cmp-rollback").getStatusCode().value()).isEqualTo(500);
            assertThat(get(S + "/" + sid, token).getBody().path("status").asText()).isEqualTo("확정");
            assertThat(get(W + "/" + wid, token).getBody().path("status").asText()).isEqualTo("지시");
        } finally {
            jdbc.execute("drop trigger test_reject_sales_cmp_audit on audit_logs");
            jdbc.execute("drop function test_reject_sales_cmp_audit()");
            cleanup(sid);
        }
    }

    private long order(String no, String token) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        var response = post(S, token, body("salesOrderNo", no, "customerId", 1, "itemId", 1, "qty", 2,
                "unitPrice", 100, "dueDate", today.plusDays(30).toString()));
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        return response.getBody().path("id").asLong();
    }

    private long confirm(long sid, String token) {
        var confirmed = post(S + "/" + sid + "/confirm", token, body());
        assertThat(confirmed.getStatusCode().value()).isEqualTo(200);
        return confirmed.getBody().path("workOrderId").asLong();
    }

    private void error(ResponseEntity<JsonNode> r, int status, String code) {
        assertThat(r.getStatusCode().value()).isEqualTo(status);
        assertThat(r.getBody().path("code").asText()).isEqualTo(code);
    }

    private void cleanup(long sid) {
        jdbc.update("delete from shipments where sales_order_id = ?", sid);
        jdbc.update("delete from work_orders where sales_order_id = ?", sid);
        jdbc.update("delete from sales_orders where id = ?", sid);
    }
}
