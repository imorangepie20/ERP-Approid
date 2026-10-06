package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

class MessageContactIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    long partner;
    String path;
    @BeforeEach void fixture() {
        partner = jdbc.queryForObject("insert into partners(partner_no,name,contact,payment_terms,partner_type) values(?,'Synthetic customer','generic@example.invalid',30,'고객사') returning id",
                Long.class, "MC-" + UUID.randomUUID().toString().substring(0, 12));
        path = "/api/core/partners/" + partner + "/message-contacts/receivable-reminder";
    }
    @AfterEach void cleanup() {
        jdbc.update("delete from partner_message_contacts where partner_id=?", partner);
        jdbc.update("delete from partners where id=?", partner);
    }
    private org.springframework.http.ResponseEntity<JsonNode> put(String token, Object input) {
        return rest.exchange(path, HttpMethod.PUT, authEntity(token, input), JsonNode.class);
    }
    private java.util.Map<String,Object> input(Integer version, String email, String permission) {
        return body("expectedVersion", version, "email", email, "permission", permission,
                "confirmationNote", "Synthetic confirmation", "acknowledged", true);
    }
    @Test void absent_contact_is_null_and_generic_contact_is_not_inferred() {
        var response = get(path, loginAdmin());
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().path("contact").isNull()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from partner_message_contacts where partner_id=?", Long.class, partner)).isZero();
    }
    @Test void permissions_allow_accounting_write_sales_read_and_reject_other_roles() {
        assertThat(rest.getForEntity(path, JsonNode.class).getStatusCode().value()).isEqualTo(401);
        for (String role : List.of("SALES", "ACCOUNTING", "PRODUCTION")) {
            String name = "message-contact-" + role.toLowerCase(); createUser(name, "password123", role);
            var token = login(name, "password123");
            assertThat(get(path, token).getStatusCode().value()).isEqualTo(role.equals("PRODUCTION") ? 403 : 200);
            assertThat(put(token, input(null, "Case@EXAMPLE.INVALID", "PENDING")).getStatusCode().value())
                    .isEqualTo(role.equals("ACCOUNTING") ? 201 : 403);
        }
    }
    @Test void validates_single_ascii_address_confirmation_and_versions_and_protects_deletion() {
        var token = loginAdmin();
        for (String address : List.of("bad", "two@example.invalid,other@example.invalid", "newline@example.invalid\r\n", "한글@example.invalid", ".dot@example.invalid", "a..b@example.invalid")) {
            assertThat(put(token, input(null, address, "PENDING")).getStatusCode().value()).isEqualTo(400);
        }
        var unconfirmed = input(null, "Case@EXAMPLE.INVALID", "ALLOWED"); unconfirmed.put("acknowledged", false);
        assertThat(put(token, unconfirmed).getStatusCode().value()).isEqualTo(400);
        unconfirmed.put("acknowledged", true); unconfirmed.put("confirmationNote", " ");
        assertThat(put(token, unconfirmed).getStatusCode().value()).isEqualTo(400);
        var allowed = put(token, input(null, "Case@EXAMPLE.INVALID", "ALLOWED"));
        assertThat(allowed.getStatusCode().value()).isEqualTo(201);
        assertThat(allowed.getBody().path("email").asText()).isEqualTo("Case@example.invalid");
        assertThat(allowed.getBody().path("version").asInt()).isZero();
        assertThat(put(token, input(null, "Case@example.invalid", "BLOCKED")).getStatusCode().value()).isEqualTo(409);
        var changed = input(0, "other@example.invalid", "ALLOWED"); changed.put("acknowledged", false);
        assertThat(put(token, changed).getStatusCode().value()).isEqualTo(400);
        assertThat(put(token, input(0, "Case@example.invalid", "BLOCKED")).getBody().path("version").asInt()).isEqualTo(1);
        assertThat(put(token, input(0, "Case@example.invalid", "ALLOWED")).getStatusCode().value()).isEqualTo(409);
        assertThat(rest.exchange("/api/core/partners/"+partner, HttpMethod.DELETE, authEntity(token, null), JsonNode.class)
                .getStatusCode().value()).isEqualTo(409);
    }
    @Test void serializes_first_registration_and_competing_versions() throws Exception {
        var token = loginAdmin(); var gate = new CountDownLatch(1);
        var a = CompletableFuture.supplyAsync(() -> { await(gate); return put(token, input(null,"first@example.invalid","PENDING")).getStatusCode().value(); });
        var b = CompletableFuture.supplyAsync(() -> { await(gate); return put(token, input(null,"second@example.invalid","PENDING")).getStatusCode().value(); });
        gate.countDown(); assertThat(List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
        var again = new CountDownLatch(1);
        var c = CompletableFuture.supplyAsync(() -> { await(again); return put(token, input(0,"first@example.invalid","BLOCKED")).getStatusCode().value(); });
        var d = CompletableFuture.supplyAsync(() -> { await(again); return put(token, input(0,"second@example.invalid","BLOCKED")).getStatusCode().value(); });
        again.countDown(); assertThat(List.of(c.get(30,TimeUnit.SECONDS),d.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
    }
    @Test void audit_failure_rolls_back_contact_registration() {
        jdbc.execute("create function test_message_contact_audit_fail() returns trigger as $$ begin if NEW.entity_type='MESSAGE_CONTACT' then raise exception 'Synthetic audit failure'; end if; return NEW; end; $$ language plpgsql");
        jdbc.execute("create trigger test_message_contact_audit_fail before insert on audit_logs for each row execute function test_message_contact_audit_fail()");
        try {
            assertThat(put(loginAdmin(), input(null,"fixture@example.invalid","ALLOWED")).getStatusCode().value()).isEqualTo(500);
            assertThat(jdbc.queryForObject("select count(*) from partner_message_contacts where partner_id=?", Long.class, partner)).isZero();
        } finally {
            jdbc.execute("drop trigger test_message_contact_audit_fail on audit_logs");
            jdbc.execute("drop function test_message_contact_audit_fail()");
        }
    }
    private static void await(CountDownLatch latch) {
        try { if (!latch.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Test gate timeout"); }
        catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new IllegalStateException(exception); }
    }
}
