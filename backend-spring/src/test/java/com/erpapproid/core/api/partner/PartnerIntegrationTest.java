package com.erpapproid.core.api.partner;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class PartnerIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired AuditLogRepository audits;

    @Test
    void admin_crud_preserves_omitted_fields_and_records_sensitive_audit() {
        String token = loginAdmin();
        var created = post("/api/core/partners", token, validBody("T-PARTNER-CRUD"), "partner-create");
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            assertThat(created.getBody().path("contactName").asText()).isEqualTo("담당자");
            assertThat(created.getBody().path("leadTimeDays").asInt()).isEqualTo(7);
            var updated = rest.exchange("/api/core/partners/" + id, HttpMethod.PATCH,
                    authEntity(token, body("paymentTerms", 45), "partner-update"), JsonNode.class);
            assertThat(updated.getStatusCode().value()).isEqualTo(200);
            assertThat(updated.getBody().path("name").asText()).isEqualTo("테스트 거래처");
            assertThat(updated.getBody().path("partnerNo").asText()).isEqualTo("T-PARTNER-CRUD");
            assertThat(updated.getBody().path("leadTimeDays").asInt()).isEqualTo(7);
            assertThat(updated.getBody().path("paymentTerms").asInt()).isEqualTo(45);
            var deleted = rest.exchange("/api/core/partners/" + id, HttpMethod.DELETE,
                    authEntity(token, null, "partner-delete"), JsonNode.class);
            assertThat(deleted.getStatusCode().value()).isEqualTo(204);
            for (String trace : new String[]{"partner-create", "partner-update", "partner-delete"}) {
                assertThat(audits.findAllByTraceIdOrderByOccurredAtAsc(trace)).singleElement().satisfies(a -> {
                    assertThat(a.isSensitive()).isTrue();
                    assertThat(a.getActorId()).isNotNull();
                    assertThat(a.getEntityType()).isEqualTo("PARTNER");
                });
            }
        } finally { jdbc.update("delete from partners where id = ?", id); }
    }

    @Test
    void sales_can_write_but_only_admin_can_delete() {
        createUser("partner-sales", "password123", "SALES");
        String token = login("partner-sales", "password123");
        var created = post("/api/core/partners", token, validBody("T-PARTNER-SALES"));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        try {
            assertThat(rest.exchange("/api/core/partners/" + id, HttpMethod.PATCH,
                    authEntity(token, body("contact", "031-111-2222")), JsonNode.class)
                    .getStatusCode().value()).isEqualTo(200);
            assertError(rest.exchange("/api/core/partners/" + id, HttpMethod.DELETE,
                    authEntity(token, null), JsonNode.class), 403, "FORBIDDEN");
            createUser("partner-viewer", "password123", "MATERIAL");
            String viewer = login("partner-viewer", "password123");
            assertError(post("/api/core/partners", viewer, validBody("T-PARTNER-DENIED")), 403, "FORBIDDEN");
            assertError(rest.exchange("/api/core/partners/" + id, HttpMethod.PATCH,
                    authEntity(viewer, body("name", "변경")), JsonNode.class), 403, "FORBIDDEN");
            assertError(rest.exchange("/api/core/partners/" + id, HttpMethod.DELETE,
                    authEntity(viewer, null), JsonNode.class), 403, "FORBIDDEN");
        } finally { jdbc.update("delete from partners where id = ?", id); }
    }

    @Test
    void duplicate_code_and_invalid_values_return_documented_errors() {
        String token = loginAdmin();
        assertError(post("/api/core/partners", token, validBody("C-001")), 409, "PARTNER_NO_DUPLICATE");
        for (Map<String, Object> invalid : java.util.List.of(
                body("partnerType", "알수없음"), body("paymentTerms", -1),
                body("leadTimeDays", -1), body("name", " "), body("contact", "x".repeat(65)))) {
            var data = validBody("T-PARTNER-INVALID");
            data.putAll(invalid);
            assertError(post("/api/core/partners", token, data), 400, "INVALID_INPUT");
        }
        assertError(rest.exchange("/api/core/partners/1", HttpMethod.PATCH,
                authEntity(token, body()), JsonNode.class), 400, "INVALID_INPUT");
    }

    @Test
    void quote_only_reference_blocks_deletion_with_partner_in_use() {
        String token = loginAdmin();
        var created = post("/api/core/partners", token, validBody("T-PARTNER-REF"));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        long id = created.getBody().path("id").asLong();
        jdbc.update("""
                insert into quotations (quotation_no, customer_id, item_id, qty, unit_price, amount, due_date, valid_until)
                values ('T-PARTNER-QUOTE', ?, 1, 1, 100, 100, current_date, current_date)
                """, id);
        try {
            assertError(rest.exchange("/api/core/partners/" + id, HttpMethod.DELETE,
                    authEntity(token, null), JsonNode.class), 409, "PARTNER_IN_USE");
        } finally {
            jdbc.update("delete from quotations where quotation_no = 'T-PARTNER-QUOTE'");
            jdbc.update("delete from partners where id = ?", id);
        }
    }

    @Test
    void list_filters_paginates_and_rejects_invalid_query() {
        String token = loginAdmin();
        var response = get("/api/core/partners?partnerType=고객사&size=2&sort=partnerNo,desc", token);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().path("content")).hasSize(2);
        assertThat(response.getBody().path("content").get(0).path("partnerType").asText()).isEqualTo("고객사");
        for (String query : new String[]{"size=101", "page=-1", "sort=unknown,asc", "partnerType=unknown"}) {
            assertError(get("/api/core/partners?" + query, token), 400, "INVALID_INPUT");
        }
        assertThat(get("/api/core/partners?keyword=%25", token).getBody().path("totalElements").asInt()).isZero();
        assertError(get("/api/core/partners", null), 401, "UNAUTHORIZED");
    }

    private Map<String, Object> validBody(String code) {
        return body("partnerNo", code, "name", "테스트 거래처", "contactName", "담당자",
                "contact", "02-1234-5678", "paymentTerms", 30, "leadTimeDays", 7, "partnerType", "고객사");
    }

    private void assertError(ResponseEntity<JsonNode> response, int status, String code) {
        assertThat(response.getStatusCode().value()).isEqualTo(status);
        assertThat(response.getBody().path("code").asText()).isEqualTo(code);
    }
}
