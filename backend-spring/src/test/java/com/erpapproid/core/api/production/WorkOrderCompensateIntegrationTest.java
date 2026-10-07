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

class WorkOrderCompensateIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/work-orders";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void cancels_completed_order_reversing_lot_and_stock_with_compensation() {
        String token = loginAdmin();
        long item = item("T-WO-CMP-P1");
        long wo = wo("T-WO-CMP-W1", item, token);
        complete(wo, token);
        try {
            long lot = jdbc.queryForObject("select id from lots where item_id = ? order by id desc limit 1", Long.class, item);
            var cancelled = post(PATH + "/" + wo + "/cancel", token, body(), "wo-cmp-cancel");
            assertThat(cancelled.getStatusCode().value()).isEqualTo(200);
            assertThat(cancelled.getBody().path("status").asText()).isEqualTo("취소");
            assertThat(cancelled.getBody().path("goodQty").decimalValue()).isEqualByComparingTo("8");
            assertThat(jdbc.queryForObject("select qty from lots where id = ?", BigDecimal.class, lot)).isEqualByComparingTo("0");
            assertThat(jdbc.queryForObject("select status from lots where id = ?", String.class, lot)).isEqualTo("폐기");
            assertThat(stock(item)).isEqualByComparingTo("0");
            assertThat(jdbc.queryForObject("select sum(qty) from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ? and txn_type = '출고'",
                    BigDecimal.class, "T-WO-CMP-W1")).isEqualByComparingTo("-8");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("wo-cmp-cancel")).hasSize(4);
            error(post(PATH + "/" + wo + "/cancel", token, body()), 409, "INVALID_STATE_TRANSITION");
        } finally { cleanup(wo, item); }
    }

    @Test
    void blocks_shipped_consumed_and_closed_orders() {
        String token = loginAdmin();
        long item = item("T-WO-CMP-P2");
        long wo = wo("T-WO-CMP-W2", item, token);
        complete(wo, token);
        try {
            long lot = jdbc.queryForObject("select id from lots where item_id = ? order by id desc limit 1", Long.class, item);
            long order = jdbc.queryForObject("insert into sales_orders(sales_order_no,customer_id,item_id,qty,unit_price,amount,due_date,status,ordered_at) values(?,1,?,2,100,200,current_date,'확정',current_date) returning id",
                    Long.class, "T-WO-CMP-SO2", item);
            try {
                jdbc.update("insert into shipments(shipment_no,sales_order_id,customer_id,item_id,lot_id,qty,amount,delivery_date,status) values(?,?,1,?,?,1,100,current_date,'배차')",
                        "T-WO-CMP-SH2", order, item, lot);
                error(post(PATH + "/" + wo + "/cancel", token, body()), 409, "IN_USE");
                jdbc.update("delete from shipments where sales_order_id = ?", order);
                post("/api/core/lots/" + lot + "/dispose", token, body());
                error(post(PATH + "/" + wo + "/cancel", token, body()), 409, "IN_USE");
            } finally {
                jdbc.update("delete from shipments where sales_order_id = ?", order);
                jdbc.update("delete from sales_orders where id = ?", order);
            }
        } finally { cleanup(wo, item); }
        long closedItem = item("T-WO-CMP-P3");
        long closed = wo("T-WO-CMP-W3", closedItem, token);
        try {
            complete(closed, token);
            post(PATH + "/" + closed + "/close", token, body());
            error(post(PATH + "/" + closed + "/cancel", token, body()), 409, "INVALID_STATE_TRANSITION");
        } finally { cleanup(closed, closedItem); }
    }

    @Test
    void blocks_compensation_when_stock_was_consumed_elsewhere() {
        String token = loginAdmin();
        long item = item("T-WO-CMP-P4");
        long wo = wo("T-WO-CMP-W4", item, token);
        complete(wo, token);
        try {
            jdbc.update("update items set stock = 5 where id = ?", item);
            error(post(PATH + "/" + wo + "/cancel", token, body()), 422, "INSUFFICIENT_STOCK");
            assertThat(stock(item)).isEqualByComparingTo("5");
            assertThat(get(PATH + "/" + wo, token).getBody().path("status").asText()).isEqualTo("완료");
        } finally { cleanup(wo, item); }
    }

    @Test
    void enforces_production_role_and_order_existence() {
        createUser("wo-cmp-production", "password123", "PRODUCTION");
        createUser("wo-cmp-sales", "password123", "SALES");
        String production = login("wo-cmp-production", "password123");
        String sales = login("wo-cmp-sales", "password123");
        String token = loginAdmin();
        long item = item("T-WO-CMP-P5");
        long wo = wo("T-WO-CMP-W5", item, token);
        complete(wo, token);
        try {
            error(post(PATH + "/" + wo + "/cancel", sales, body()), 403, "FORBIDDEN");
            error(post(PATH + "/" + wo + "/cancel", body()), 401, "UNAUTHORIZED");
            error(post(PATH + "/999999/cancel", production, body()), 404, "WORK_ORDER_NOT_FOUND");
            assertThat(post(PATH + "/" + wo + "/cancel", production, body()).getStatusCode().value()).isEqualTo(200);
        } finally { cleanup(wo, item); }
    }

    @Test
    void audit_failure_rolls_back_compensation_stock_lot_and_status() {
        String token = loginAdmin();
        long item = item("T-WO-CMP-P6");
        long wo = wo("T-WO-CMP-W6", item, token);
        complete(wo, token);
        jdbc.execute("create function test_reject_wo_cmp_audit() returns trigger language plpgsql as $$ begin if NEW.trace_id = 'wo-cmp-rollback' then raise exception 'test audit rejection'; end if; return NEW; end $$");
        jdbc.execute("create trigger test_reject_wo_cmp_audit before insert on audit_logs for each row execute function test_reject_wo_cmp_audit()");
        try {
            assertThat(post(PATH + "/" + wo + "/cancel", token, body(), "wo-cmp-rollback").getStatusCode().value()).isEqualTo(500);
            assertThat(get(PATH + "/" + wo, token).getBody().path("status").asText()).isEqualTo("완료");
            assertThat(stock(item)).isEqualByComparingTo("8");
            assertThat(jdbc.queryForObject("select count(*) from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ? and txn_type = '출고'",
                    Long.class, "T-WO-CMP-W6")).isZero();
        } finally {
            jdbc.execute("drop trigger test_reject_wo_cmp_audit on audit_logs");
            jdbc.execute("drop function test_reject_wo_cmp_audit()");
            cleanup(wo, item);
        }
    }

    private long item(String no) {
        return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'보상 검증 제품','제품','EA',100,0,0,0) returning id", Long.class, no);
    }

    private long wo(String no, long item, String token) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        var response = post(PATH, token, body("workOrderNo", no, "itemId", item, "qty", 10, "dueDate", today.plusDays(10).toString()));
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        return response.getBody().path("id").asLong();
    }

    private void complete(long wo, String token) {
        post(PATH + "/" + wo + "/progress", token, body("goodQty", 8, "defectQty", 2));
        var done = post(PATH + "/" + wo + "/complete", token, body());
        assertThat(done.getStatusCode().value()).isEqualTo(200);
    }

    private BigDecimal stock(long item) { return jdbc.queryForObject("select stock from items where id = ?", BigDecimal.class, item); }

    private void error(ResponseEntity<JsonNode> r, int status, String code) {
        assertThat(r.getStatusCode().value()).isEqualTo(status);
        assertThat(r.getBody().path("code").asText()).isEqualTo(code);
    }

    private void cleanup(Long wo, Long item) {
        if (wo != null) {
            String no = jdbc.queryForObject("select work_order_no from work_orders where id = ?", String.class, wo);
            jdbc.update("delete from inventory_transactions where ref_type = 'WORK_ORDER' and ref_no = ?", no);
            jdbc.update("delete from work_orders where id = ?", wo);
        }
        if (item != null) {
            jdbc.update("delete from inventory_transactions where item_id = ?", item);
            jdbc.update("delete from lots where item_id = ?", item);
            jdbc.update("delete from items where id = ?", item);
        }
    }
}
