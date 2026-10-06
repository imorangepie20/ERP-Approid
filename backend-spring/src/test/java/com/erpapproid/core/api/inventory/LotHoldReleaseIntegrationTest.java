package com.erpapproid.core.api.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class LotHoldReleaseIntegrationTest extends IntegrationTestSupport {
    private static final String PATH = "/api/core/lots";
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void hold_and_release_cycle_with_audits() {
        String token = loginAdmin(); long item = item("T-HOLD-CYCLE");
        long lot = lot(item, "T-HOLD-CYCLE", "정상");
        try {
            assertThat(post(PATH + "/" + lot + "/hold", token, body(), "lot-hold").getBody().path("status").asText()).isEqualTo("보류");
            assertThat(post(PATH + "/" + lot + "/release", token, body(), "lot-release").getBody().path("status").asText()).isEqualTo("정상");
            assertThat(status(lot)).isEqualTo("정상");
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("lot-hold")).hasSize(1);
            assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc("lot-release")).hasSize(1);
        } finally { cleanup(item); }
    }

    @Test
    void blocks_disposed_recovery_and_release_without_hold() {
        String token = loginAdmin(); long item = item("T-HOLD-BLOCK");
        long disposed = lot(item, "T-HOLD-DISP", "폐기");
        long normal = lot(item, "T-HOLD-NORM", "정상");
        try {
            error(post(PATH + "/" + disposed + "/hold", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(post(PATH + "/" + disposed + "/release", token, body()), 409, "INVALID_STATE_TRANSITION");
            error(post(PATH + "/" + normal + "/release", token, body()), 409, "INVALID_STATE_TRANSITION");
            assertThat(status(disposed)).isEqualTo("폐기");
            assertThat(status(normal)).isEqualTo("정상");
        } finally { cleanup(item); }
    }

    @Test
    void enforces_material_quality_admin_roles() {
        createUser("hold-material", "password123", "MATERIAL");
        createUser("hold-quality", "password123", "QUALITY");
        createUser("hold-sales", "password123", "SALES");
        String material = login("hold-material", "password123");
        String quality = login("hold-quality", "password123");
        String sales = login("hold-sales", "password123");
        long item = item("T-HOLD-ROLE");
        long lot = lot(item, "T-HOLD-ROLE", "정상");
        try {
            error(post(PATH + "/" + lot + "/hold", sales, body()), 403, "FORBIDDEN");
            error(post(PATH + "/" + lot + "/hold", body()), 401, "UNAUTHORIZED");
            error(post(PATH + "/999999999/hold", material, body()), 404, "LOT_NOT_FOUND");
            assertThat(post(PATH + "/" + lot + "/hold", material, body()).getBody().path("status").asText()).isEqualTo("보류");
            assertThat(post(PATH + "/" + lot + "/release", quality, body()).getBody().path("status").asText()).isEqualTo("정상");
        } finally { cleanup(item); }
    }

    private long item(String no) { return jdbc.queryForObject("insert into items(item_no,name,item_type,unit,price,stock,safety_stock,lead_time_days) values (?,'보류 검증 자재','자재','KG',100,50,0,0) returning id", Long.class, no); }
    private long lot(long item, String no, String status) { return jdbc.queryForObject("insert into lots(lot_no,item_id,warehouse,qty,produced_at,status) values (?,?,'자재창고',10,current_date,?) returning id", Long.class, no, item, status); }
    private String status(long lot) { return jdbc.queryForObject("select status from lots where id = ?", String.class, lot); }
    private void error(ResponseEntity<JsonNode> r, int status, String code) { assertThat(r.getStatusCode().value()).isEqualTo(status); assertThat(r.getBody().path("code").asText()).isEqualTo(code); }
    private void cleanup(long item) {
        jdbc.update("delete from lots where item_id = ?", item);
        jdbc.update("delete from items where id = ?", item);
    }
}
