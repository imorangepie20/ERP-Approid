package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.erpapproid.core.api.messaging.EmailDeliveryProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.support.IntegrationTestSupport;

@TestPropertySource(properties={"erp.messaging.email.enabled=true", "erp.messaging.email.scheduling-enabled=false"})
class ReceivableReminderRequestIntegrationTest extends IntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired EmailDeliveryProperties properties;
    @MockitoBean(name="messageClock") Clock clock;
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-10-04T14:00:00Z"), ZoneId.of("Asia/Seoul"));
    long partner, receivable, contact;
    String path;
    @BeforeEach void fixture() {
        when(clock.withZone(ZoneId.of("Asia/Seoul"))).thenReturn(FIXED_CLOCK);
        when(clock.instant()).thenReturn(FIXED_CLOCK.instant());
        String key="MR-"+UUID.randomUUID().toString().substring(0,12);
        partner=jdbc.queryForObject("insert into partners(partner_no,name,partner_type) values(?,'Synthetic customer','고객사') returning id",Long.class,key);
        receivable=jdbc.queryForObject("insert into receivables(receivable_no,customer_id,amount,collected_amount,due_date,status) values(?,?,100,30,?,'미수') returning id",Long.class,key,partner,LocalDate.now(FIXED_CLOCK).minusDays(3));
        contact=jdbc.queryForObject("insert into partner_message_contacts(partner_id,email,permission,confirmation_note,confirmed_by,confirmed_at) values(?,'fixture@example.invalid','ALLOWED','Synthetic confirmation',1,now()) returning id",Long.class,partner);
        path="/api/core/receivables/"+receivable;
    }
    @AfterEach void cleanup() {
        jdbc.update("delete from message_retry_requests where message_id in (select id from outbound_messages where receivable_id=?)",receivable);
        jdbc.update("delete from message_delivery_attempts where message_id in (select id from outbound_messages where receivable_id=?)",receivable);
        jdbc.update("delete from outbound_messages where receivable_id=?",receivable);
        jdbc.update("delete from receivables where id=?",receivable);
        jdbc.update("delete from partner_message_contacts where partner_id=?",partner);
        jdbc.update("delete from partners where id=?",partner);
    }
    private Map<String,Object> input(String token) {
        var preview=get(path+"/reminder-preview",token).getBody();
        assertThat(preview.path("snapshotHash").asText()).matches("[a-f0-9]{64}");
        return body("requestId",UUID.randomUUID(),"contactId",contact,"expectedSnapshotHash",preview.path("snapshotHash").asText(),"note","Synthetic additional note","acknowledged",true);
    }
    @Test void queues_server_generated_partial_balance_snapshot_and_replays_without_writes() {
        var token=loginAdmin(); var request=input(token);
        var first=post(path+"/reminders",token,request,"message-request-trace");
        assertThat(first.getStatusCode().value()).isEqualTo(202);
        var message=first.getBody().path("message");
        assertThat(message.path("id").asText()).isEqualTo(request.get("requestId").toString());
        assertThat(message.path("state").asText()).isEqualTo("QUEUED");
        assertThat(message.path("remainingAmount").asLong()).isEqualTo(70);
        assertThat(Instant.parse(message.path("requestedAt").asText())).isEqualTo(FIXED_CLOCK.instant());
        assertThat(Instant.parse(message.path("expiresAt").asText())).isEqualTo(FIXED_CLOCK.instant().plusSeconds(900));
        assertThat(message.path("body").asText()).contains("70원","Synthetic additional note").doesNotContain("100원");
        assertThat(get("/api/core/messages/"+request.get("requestId"),token).getStatusCode().value()).isEqualTo(200);
        jdbc.update("update receivables set collected_amount=60 where id=?",receivable);
        var repeated=post(path+"/reminders",token,request);
        assertThat(repeated.getStatusCode().value()).isEqualTo(200);
        assertThat(repeated.getBody().path("replayed").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from outbound_messages where receivable_id=?",Long.class,receivable)).isEqualTo(1);
        // UUID remains unchanged in the API/queue and snapshot; audit entity_no is a
        // lossless 32-hex representation compatible with the established VARCHAR(32).
        String auditNo=request.get("requestId").toString().replace("-", "");
        assertThat(auditNo).matches("[a-f0-9]{32}");
        assertThat(jdbc.queryForObject("select count(*) from audit_logs where entity_type='MESSAGE' and entity_no=?",Long.class,auditNo)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select after_json->>'id' from audit_logs where entity_type='MESSAGE' and entity_no=?",String.class,auditNo)).isEqualTo(request.get("requestId").toString());
        assertThat(jdbc.queryForObject("select trace_id from audit_logs where entity_type='MESSAGE' and entity_no=?",String.class,auditNo)).isEqualTo("message-request-trace");
        assertThat(jdbc.queryForObject("select actor_id from audit_logs where entity_type='MESSAGE' and entity_no=?",Long.class,auditNo))
                .isEqualTo(jdbc.queryForObject("select actor_id from outbound_messages where id=?",Long.class,request.get("requestId")));
        assertThat(jdbc.queryForObject("select sensitive from audit_logs where entity_type='MESSAGE' and entity_no=?",Boolean.class,auditNo)).isTrue();
        assertThat(jdbc.queryForObject("select trace_id from outbound_messages where id=?",String.class,request.get("requestId"))).isEqualTo("message-request-trace");
        assertThat(jdbc.queryForObject("select count(*) from message_delivery_attempts where message_id=?",Long.class,request.get("requestId"))).isZero();
    }
    @Test void rejects_changed_hash_input_keys_unconfirmed_or_blocked_requests() {
        var token=loginAdmin(); var old=input(token);
        jdbc.update("update receivables set collected_amount=60 where id=?",receivable);
        assertThat(post(path+"/reminders",token,old).getStatusCode().value()).isEqualTo(409);
        var unconfirmed=input(token); unconfirmed.put("acknowledged",false);
        assertThat(post(path+"/reminders",token,unconfirmed).getStatusCode().value()).isEqualTo(400);
        var request=input(token); assertThat(post(path+"/reminders",token,request).getStatusCode().value()).isEqualTo(202);
        request.put("note","Changed input"); assertThat(post(path+"/reminders",token,request).getStatusCode().value()).isEqualTo(409);
        assertThat(post(path+"/reminders",token,input(token)).getStatusCode().value()).isEqualTo(409);
        jdbc.update("update outbound_messages set state='FAILED' where receivable_id=?",receivable);
        jdbc.update("update partner_message_contacts set permission='BLOCKED',version=version+1 where id=?",contact);
        assertThat(post(path+"/reminders",token,input(token)).getStatusCode().value()).isEqualTo(422);
    }
    @Test void unknown_and_seoul_daily_acceptance_block_new_requests_and_history_is_paged() {
        var token=loginAdmin();var first=input(token);post(path+"/reminders",token,first);
        jdbc.update("update outbound_messages set state='UNKNOWN' where receivable_id=?",receivable);
        assertThat(post(path+"/reminders",token,input(token)).getStatusCode().value()).isEqualTo(409);
        jdbc.update("update outbound_messages set state='SMTP_ACCEPTED',accepted_at=?,accepted_on=? where receivable_id=?",
                java.sql.Timestamp.from(FIXED_CLOCK.instant()),LocalDate.now(FIXED_CLOCK),receivable);
        assertThat(post(path+"/reminders",token,input(token)).getStatusCode().value()).isEqualTo(409);
        assertThat(get(path+"/reminders?size=1",token).getBody().path("totalElements").asLong()).isEqualTo(1);
        assertThat(get(path+"/reminders?size=101",token).getStatusCode().value()).isEqualTo(400);
    }
    @Test void protects_read_and_write_roles_and_non_overdue_documents() {
        var admin=loginAdmin(); var request=input(admin);
        for(String role:List.of("SALES","ACCOUNTING","PRODUCTION")) {
            String name="message-request-"+role.toLowerCase();createUser(name,"password123",role);var token=login(name,"password123");
            assertThat(get(path+"/reminders",token).getStatusCode().value()).isEqualTo(role.equals("PRODUCTION")?403:200);
            assertThat(post(path+"/reminders",token,request).getStatusCode().value()).isEqualTo(role.equals("ACCOUNTING")?202:403);
        }
        assertThat(post(path+"/reminders",admin,request).getStatusCode().value()).isEqualTo(409);
        jdbc.update("update outbound_messages set state='FAILED' where receivable_id=?",receivable);
        jdbc.update("update receivables set due_date=? where id=?",LocalDate.now(FIXED_CLOCK),receivable);
        assertThat(post(path+"/reminders",admin,input(admin)).getStatusCode().value()).isEqualTo(422);
    }
    @Test void competing_request_keys_create_only_one_queue_row() throws Exception {
        var token=loginAdmin(); var a=input(token);var b=input(token);var gate=new CountDownLatch(1);
        var first=CompletableFuture.supplyAsync(()->{await(gate);return post(path+"/reminders",token,a).getStatusCode().value();});
        var second=CompletableFuture.supplyAsync(()->{await(gate);return post(path+"/reminders",token,b).getStatusCode().value();});
        gate.countDown();assertThat(List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(202,409);
    }
    @Test void audit_failure_rolls_back_the_queue() {
        var token=loginAdmin();var request=input(token);
        jdbc.execute("create function test_message_request_audit_fail() returns trigger as $$ begin if NEW.entity_type='MESSAGE' then raise exception 'Synthetic audit failure'; end if; return NEW; end; $$ language plpgsql");
        jdbc.execute("create trigger test_message_request_audit_fail before insert on audit_logs for each row execute function test_message_request_audit_fail()");
        try {
            assertThat(post(path+"/reminders",token,request).getStatusCode().value()).isEqualTo(500);
            assertThat(jdbc.queryForObject("select count(*) from outbound_messages where receivable_id=?",Long.class,receivable)).isZero();
        } finally {
            jdbc.execute("drop trigger test_message_request_audit_fail on audit_logs");jdbc.execute("drop function test_message_request_audit_fail()");
        }
    }
    @Test void disabled_delivery_rejects_requests_without_saving_queue_or_audit() {
        var token=loginAdmin(); var request=input(token);
        long auditCount=jdbc.queryForObject("select count(*) from audit_logs",Long.class);
        properties.setEnabled(false);
        try {
            assertThat(get(path+"/reminder-preview",token).getBody().path("emailDispatchEnabled").asBoolean()).isFalse();
            assertThat(post(path+"/reminders",token,request).getStatusCode().value()).isEqualTo(503);
            assertThat(jdbc.queryForObject("select count(*) from outbound_messages where receivable_id=?",Long.class,receivable)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from audit_logs",Long.class)).isEqualTo(auditCount);
        } finally { properties.setEnabled(true); }
    }
    @Test void unregistered_contacts_and_unauthenticated_access_never_queue_messages() {
        var token=loginAdmin();
        jdbc.update("delete from partner_message_contacts where id=?",contact);
        assertThat(post(path+"/reminders",token,input(token)).getStatusCode().value()).isEqualTo(422);
        assertThat(rest.postForEntity(path+"/reminders",input(token),JsonNode.class).getStatusCode().value()).isEqualTo(401);
        assertThat(rest.getForEntity(path+"/reminders",JsonNode.class).getStatusCode().value()).isEqualTo(401);
        assertThat(rest.getForEntity("/api/core/messages/"+UUID.randomUUID(),JsonNode.class).getStatusCode().value()).isEqualTo(401);
        assertThat(jdbc.queryForObject("select count(*) from outbound_messages where receivable_id=?",Long.class,receivable)).isZero();
    }
    private static void await(CountDownLatch gate) {
        try { if(!gate.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Test gate timeout"); }
        catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
    }
}
