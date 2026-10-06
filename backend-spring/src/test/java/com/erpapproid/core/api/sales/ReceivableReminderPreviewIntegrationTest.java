package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

class ReceivableReminderPreviewIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    private String path(long id) { return "/api/core/receivables/" + id + "/reminder-preview"; }

    @Test void reads_actual_partial_balance_and_current_contact_without_writes_or_guessed_channel() {
        long customer = customer("담당자", "010-1234-5678"), id = receivable(customer);
        try {
            long audits = jdbc.queryForObject("select count(*) from audit_logs", Long.class);
            long history = jdbc.queryForObject("select count(*) from receivable_collections", Long.class);
            var response = get(path(id), loginAdmin());
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            var body = response.getBody();
            assertThat(body.path("receivable").path("amount").asLong()).isEqualTo(100);
            assertThat(body.path("receivable").path("remainingAmount").asLong()).isEqualTo(70);
            assertThat(body.path("receivable").path("overdueDays").asInt()).isEqualTo(3);
            assertThat(body.path("contactName").asText()).isEqualTo("담당자");
            assertThat(body.path("contact").asText()).isEqualTo("010-1234-5678");
            assertThat(body.has("channel")).isFalse();
            jdbc.update("update partners set contact='updated@example.test' where id=?", customer);
            jdbc.update("update receivables set collected_amount=60 where id=?", id);
            var refreshed = get(path(id), loginAdmin()).getBody();
            assertThat(refreshed.path("contact").asText()).isEqualTo("updated@example.test");
            assertThat(refreshed.path("receivable").path("remainingAmount").asLong()).isEqualTo(40);
            assertThat(jdbc.queryForObject("select count(*) from audit_logs", Long.class)).isEqualTo(audits);
            assertThat(jdbc.queryForObject("select count(*) from receivable_collections", Long.class)).isEqualTo(history);
            assertThat(jdbc.queryForObject("select overdue_days from receivables where id=?", Integer.class, id)).isEqualTo(999);
        } finally { cleanup(customer); }
    }

    @Test void preserves_missing_contacts_and_paid_document_facts_instead_of_fabricating_recipients() {
        long customer = customer(null, null), id = receivable(customer);
        try {
            jdbc.update("update receivables set collected_amount=100,status='수납완료' where id=?", id);
            var body = get(path(id), loginAdmin()).getBody();
            assertThat(body.has("contact")).isTrue(); assertThat(body.path("contact").isNull()).isTrue();
            assertThat(body.has("contactName")).isTrue(); assertThat(body.path("contactName").isNull()).isTrue();
            assertThat(body.path("receivable").path("remainingAmount").asLong()).isZero();
            assertThat(body.path("receivable").path("overdue").asBoolean()).isFalse();
        } finally { cleanup(customer); }
    }

    @Test void enforces_read_roles_and_input_errors_and_has_no_preview_write_action() {
        long customer = customer(null, null), id = receivable(customer);
        try {
            assertThat(rest.getForEntity(path(id), JsonNode.class).getStatusCode().value()).isEqualTo(401);
            for (String role : new String[]{"SALES", "ACCOUNTING", "MATERIAL", "PRODUCTION", "QUALITY"}) {
                String username = "rmd-" + role.toLowerCase();
                createUser(username, "password123", role);
                assertThat(get(path(id), login(username, "password123")).getStatusCode().value()).isEqualTo(
                        role.equals("SALES") || role.equals("ACCOUNTING") ? 200 : 403);
            }
            assertThat(get(path(0), loginAdmin()).getStatusCode().value()).isEqualTo(400);
            var missing = get(path(Long.MAX_VALUE), loginAdmin());
            assertThat(missing.getStatusCode().value()).isEqualTo(404);
            assertThat(missing.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
            assertThat(post(path(id), loginAdmin(), body("recipient", "unused@example.test")).getStatusCode().value()).isEqualTo(405);
            var api = rest.getForEntity("/v3/api-docs", JsonNode.class).getBody();
            assertThat(api.path("paths").path("/api/core/receivables/{id}/reminder-preview").has("get")).isTrue();
        } finally { cleanup(customer); }
    }

    private long customer(String name, String contact) {
        return jdbc.queryForObject("insert into partners(partner_no,name,partner_type,contact_name,contact) values(?,'미리보기 테스트 고객','고객사',?,?) returning id", Long.class, key(), name, contact);
    }
    private long receivable(long customer) {
        return jdbc.queryForObject("insert into receivables(receivable_no,customer_id,amount,collected_amount,due_date,status,overdue_days) values(?,?,100,30,?,'미수',999) returning id", Long.class, key(), customer, LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(3));
    }
    private String key() { return "RMD-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20); }
    private void cleanup(long customer) {
        jdbc.update("delete from receivables where customer_id=?", customer);
        jdbc.update("delete from partners where id=?", customer);
    }
}
