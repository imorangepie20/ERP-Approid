package com.erpapproid.core.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.erpapproid.core.support.IntegrationTestSupport;

class MrpIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/analytics/mrp/suggestions";
    @Autowired JdbcTemplate jdbc;
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));

    @Test
    void database_bom_stock_partial_purchase_and_future_work_are_netted_then_real_purchase_order_covers_shortage() {
        long product = item("제품", "EA", 0, 0, 1), semi = item("반제품", "EA", 5, 2, 2), material = item("자재", "kg", 10, 2, 4);
        long vendor = jdbc.queryForObject("select id from partners where partner_type='발주처' order by id limit 1", Long.class);
        try {
            bom(product, semi, "2", "10"); bom(product, material, "1", "0"); bom(semi, material, "3", "5");
            work(product, 10, 0, today.plusDays(10), today.plusDays(15)); work(semi, 4, 1, today.plusDays(3), today.plusDays(5));
            // Excluded future-start/cancelled work must not inflate requirements.
            work(product, 999, 0, today.plusDays(91), today.plusDays(95));
            jdbc.update("insert into lots(lot_no,item_id,warehouse,qty,produced_at,status) values(?,?,'자재창고',1,?,'보류')", key(), material, today);
            jdbc.update("insert into lots(lot_no,item_id,warehouse,qty,produced_at,expiry,status) values(?,?,'자재창고',1,?,?,'정상')", key(), material, today.minusDays(2), today.minusDays(1));
            purchase(vendor, semi, "3", "0", "발주"); purchase(vendor, material, "10", "4", "부분입고");
            purchase(vendor, material, "999", "0", "취소"); purchase(vendor, material, "999", "999", "입고완료");
            var r = get(PATH + "?itemId=" + material, loginAdmin());
            assertThat(r.getStatusCode().value()).isEqualTo(200);
            assertThat(r.getBody().path("rows")).hasSize(1);
            var row = r.getBody().path("rows").get(0);
            assertThat(row.path("grossRequirement").decimalValue()).isEqualByComparingTo("63.55");
            assertThat(row.path("usableStock").decimalValue()).isEqualByComparingTo("8");
            assertThat(row.path("onOrder").decimalValue()).isEqualByComparingTo("6");
            assertThat(row.path("suggestedPurchaseQty").decimalValue()).isEqualByComparingTo("51.55");
            assertThat(row.path("lateSupplyQty").decimalValue()).isEqualByComparingTo("6");
            assertThat(row.path("unit").asText()).isEqualTo("kg");
            assertThat(r.getBody().path("notes").toString()).contains("불출");
            createUser("mrp-material", "password123", "MATERIAL");
            String actor = login("mrp-material", "password123"), no = key();
            var request = body("purchaseOrderNo", no, "vendorId", vendor, "itemId", material,
                    "qty", row.path("suggestedPurchaseQty").decimalValue(), "unitPrice", 100, "dueDate", today.plusDays(20).toString());
            var created = post("/api/core/purchase-orders", actor, request, "mrp-create-po");
            assertThat(created.getStatusCode().value()).isEqualTo(201);
            assertThat(created.getBody().path("amount").asLong()).isEqualTo(5155);
            assertThat(jdbc.queryForObject("select count(*) from purchase_orders where purchase_order_no=?", Long.class, no)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select stock from items where id=?", BigDecimal.class, material)).isEqualByComparingTo("10");
            var after = get(PATH + "?itemId=" + material, actor).getBody().path("rows").get(0);
            assertThat(after.path("suggestedPurchaseQty").decimalValue()).isZero();
            assertThat(after.path("action").asText()).isEqualTo("EXPEDITE");
            assertThat(post("/api/core/purchase-orders", actor, request).getStatusCode().value()).isEqualTo(409);
            assertThat(jdbc.queryForObject("select count(*) from audit_logs where trace_id='mrp-create-po'", Long.class)).isEqualTo(1);
        } finally { cleanup(product); cleanup(semi); cleanup(material); }
    }

    @Test
    void requires_auth_validates_dates_paging_ids_and_preserves_read_only_role_boundary() {
        assertThat(rest.getForEntity(PATH, String.class).getStatusCode().value()).isEqualTo(401);
        createUser("mrp-sales", "password123", "SALES"); String token = login("mrp-sales", "password123");
        assertThat(get(PATH + "?size=1", token).getStatusCode().value()).isEqualTo(200);
        assertThat(get(PATH + "?page=100000&size=1", token).getBody().path("rows")).isEmpty();
        for (String q : new String[] { "through=" + today.minusDays(1), "through=" + today.plusDays(366), "through=bad", "page=-1", "size=0", "size=101", "itemId=0" }) {
            var r = get(PATH + "?" + q, token); assertThat(r.getStatusCode().value()).isEqualTo(400);
            assertThat(r.getBody().path("code").asText()).isEqualTo("INVALID_INPUT");
        }
        assertThat(get(PATH + "?itemId=9223372036854775807", token).getStatusCode().value()).isEqualTo(404);
        assertThat(post("/api/core/purchase-orders", token, body("purchaseOrderNo", key(), "vendorId", 1,
                "itemId", 1, "qty", 1, "unitPrice", 100, "dueDate", today.toString())).getStatusCode().value()).isEqualTo(403);
        var doc = rest.getForEntity("/v3/api-docs", com.fasterxml.jackson.databind.JsonNode.class).getBody();
        assertThat(doc.path("components").path("schemas").path("MrpRow").isMissingNode()).isFalse();
    }

    @Test
    void corrupt_cycle_fails_whole_plan_instead_of_returning_partial_quantities() {
        long a = item("제품", "EA", 0, 0, 0), b = item("반제품", "EA", 0, 0, 0);
        try {
            bom(a, b, "1", "0"); bom(b, a, "1", "0");
            var r = get(PATH, loginAdmin()); assertThat(r.getStatusCode().value()).isEqualTo(409);
            assertThat(r.getBody().path("code").asText()).isEqualTo("BOM_CYCLE");
            assertThat(r.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        } finally { cleanup(a); cleanup(b); }
    }

    @Test
    void purchase_conversion_rejects_precision_money_overflow_and_customer_vendor_without_writing() {
        long material = item("자재", "kg", 0, 0, 0);
        long vendor = jdbc.queryForObject("select id from partners where partner_type='발주처' order by id limit 1", Long.class);
        long customer = jdbc.queryForObject("select id from partners where partner_type='고객사' order by id limit 1", Long.class);
        String token = loginAdmin();
        try {
            for (var request : java.util.List.of(
                    body("purchaseOrderNo", "X".repeat(33), "vendorId", vendor, "itemId", material, "qty", 1, "unitPrice", 100, "dueDate", today.toString()),
                    body("purchaseOrderNo", key(), "vendorId", vendor, "itemId", material, "qty", new BigDecimal("0.00001"), "unitPrice", 100, "dueDate", today.toString()),
                    body("purchaseOrderNo", key(), "vendorId", vendor, "itemId", material, "qty", new BigDecimal("100000000000000"), "unitPrice", 100, "dueDate", today.toString()),
                    body("purchaseOrderNo", key(), "vendorId", vendor, "itemId", material, "qty", 1, "unitPrice", 9007199254740992L, "dueDate", today.toString()),
                    body("purchaseOrderNo", key(), "vendorId", vendor, "itemId", material, "qty", 2, "unitPrice", 9007199254740991L, "dueDate", today.toString()),
                    body("purchaseOrderNo", key(), "vendorId", customer, "itemId", material, "qty", 1, "unitPrice", 100, "dueDate", today.toString()))) {
                assertThat(post("/api/core/purchase-orders", token, request).getStatusCode().value()).isEqualTo(400);
            }
            assertThat(jdbc.queryForObject("select count(*) from purchase_orders where item_id=?", Long.class, material)).isZero();
        } finally { cleanup(material); }
    }

    private long item(String type, String unit, int stock, int safety, int lead) {
        return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values(?,'MRP 통합',?,?,100,?,?,?) returning id", Long.class, key(), type, unit, stock, safety, lead);
    }
    private void bom(long parent, long child, String qty, String loss) { jdbc.update("insert into boms(bom_no,parent_id,child_id,qty,loss_rate) values(?,?,?,?,?)", key(), parent, child, new BigDecimal(qty), new BigDecimal(loss)); }
    private void work(long item, int qty, int defect, LocalDate start, LocalDate due) { jdbc.update("insert into work_orders(work_order_no,item_id,qty,defect_qty,start_date,due_date,status) values(?,?,?,?,?,?,'지시')", key(), item, qty, defect, start, due); }
    private void purchase(long vendor, long item, String qty, String received, String status) {
        jdbc.update("insert into purchase_orders(purchase_order_no,vendor_id,item_id,qty,unit_price,amount,received_qty,due_date,status) values(?,?,?,?,100,?,?,?,?)", key(), vendor, item, new BigDecimal(qty), new BigDecimal(qty).multiply(BigDecimal.valueOf(100)).longValueExact(), new BigDecimal(received), today.plusDays(20), status);
    }
    private String key() { return "MRP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20); }
    private void cleanup(long item) {
        jdbc.update("delete from boms where parent_id=? or child_id=?", item, item);
        jdbc.update("delete from purchase_orders where item_id=?", item);
        jdbc.update("delete from work_orders where item_id=?", item);
        jdbc.update("delete from lots where item_id=?", item);
        jdbc.update("delete from items where id=?", item);
    }
}
