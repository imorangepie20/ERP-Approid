package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.erpapproid.core.domain.messaging.DeliveryOutcome;
import com.erpapproid.core.support.IntegrationTestSupport;

/** EMAIL-06 RED: automatic retry delays, manual retry endpoint and UNKNOWN guards do not exist yet. */
@TestPropertySource(properties={"erp.messaging.email.enabled=true", "erp.messaging.email.scheduling-enabled=false", "erp.messaging.email.host=test.invalid", "erp.messaging.email.username=test", "erp.messaging.email.password=test", "erp.messaging.email.from=test@example.invalid", "erp.messaging.email.envelope-from=test@example.invalid"})
class MessageRetryIntegrationTest extends IntegrationTestSupport {
    private static final Instant NOW=Instant.parse("2026-10-04T14:00:00Z");
    private static final ZoneId SEOUL=ZoneId.of("Asia/Seoul");
    private static final EmailSubmissionResult TRANSIENT=new EmailSubmissionResult(
            DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_TRANSIENT,EmailSubmissionResult.Failure.SMTP_TRANSIENT_FAILURE);
    private static final EmailSubmissionResult PERMANENT=new EmailSubmissionResult(
            DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT,EmailSubmissionResult.Failure.SMTP_PERMANENT_FAILURE);
    @Autowired JdbcTemplate jdbc;
    @Autowired MessageDispatchService worker;
    @Autowired EmailDeliveryProperties properties;
    @MockitoBean(name="messageClock") Clock clock;
    @MockitoBean EmailTransport transport;
    private final List<Long> partners=new ArrayList<>();
    private final List<Long> actors=new ArrayList<>();
    private Instant now;
    private long actor;
    private String token;

    record Fixture(long partner, long receivable, long contact, UUID message) {}

    @BeforeEach void setup() {
        now=NOW; properties.setEnabled(true);
        when(clock.instant()).thenAnswer(invocation->now);
        when(clock.withZone(SEOUL)).thenAnswer(invocation->Clock.fixed(now,SEOUL));
        String username="retry-"+UUID.randomUUID().toString().substring(0,12);
        createUser(username,"password123","ACCOUNTING");
        actor=jdbc.queryForObject("select id from users where username=?",Long.class,username);
        actors.add(actor); token=login(username,"password123");
    }

    @AfterEach void cleanup() {
        properties.setEnabled(true);
        for(long partner:partners) {
            jdbc.update("delete from message_retry_requests where message_id in (select id from outbound_messages where partner_id=?)",partner);
            jdbc.update("delete from message_delivery_attempts where message_id in (select id from outbound_messages where partner_id=?)",partner);
            jdbc.update("delete from outbound_messages where partner_id=?",partner);
            jdbc.update("delete from receivable_collections where receivable_id in (select id from receivables where customer_id=?)",partner);
            jdbc.update("delete from receivables where customer_id=?",partner);
            jdbc.update("delete from partner_message_contacts where partner_id=?",partner);
            jdbc.update("delete from partners where id=?",partner);
        }
        for(long id:actors) {
            jdbc.update("delete from audit_logs where actor_id=?",id);
            jdbc.update("delete from user_roles where user_id=?",id);
            jdbc.update("delete from users where id=?",id);
        }
    }

    private Fixture queue() {
        String key="RT-"+UUID.randomUUID().toString().substring(0,12);
        long partner=jdbc.queryForObject("insert into partners(partner_no,name,partner_type) values(?,'Retry customer','고객사') returning id",Long.class,key);
        partners.add(partner);
        long receivable=jdbc.queryForObject("insert into receivables(receivable_no,customer_id,amount,collected_amount,due_date,status) values(?,?,100,30,?,'미수') returning id",Long.class,key,partner,LocalDate.now(Clock.fixed(now,SEOUL)).minusDays(3));
        long contact=jdbc.queryForObject("insert into partner_message_contacts(partner_id,email,permission,confirmation_note,confirmed_by,confirmed_at) values(?,'retry@example.invalid','ALLOWED','Retry permission',?,now()) returning id",Long.class,partner,actor);
        String path="/api/core/receivables/"+receivable;
        var preview=get(path+"/reminder-preview",token).getBody();
        UUID message=UUID.randomUUID();
        assertThat(post(path+"/reminders",token,body("requestId",message,"contactId",contact,
                "expectedSnapshotHash",preview.path("snapshotHash").asText(),"note","","acknowledged",true),"retained-retry-trace").getStatusCode().value()).isEqualTo(202);
        return new Fixture(partner,receivable,contact,message);
    }

    private String state(UUID id) {
        return jdbc.queryForObject("select state from outbound_messages where id=?",String.class,id);
    }

    private long attempts(UUID id) {
        return jdbc.queryForObject("select count(*) from message_delivery_attempts where message_id=?",Long.class,id);
    }

    private void lockActor() {
        jdbc.update("update users set status='잠김' where id=?",actor);
    }

    private void unlockActor() {
        jdbc.update("update users set status='활성' where id=?",actor);
    }

    private Fixture failedWithOneAttempt() {
        var f=queue();
        when(transport.submit(any())).thenReturn(TRANSIENT);
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(f.message())).isEqualTo("RETRY_WAIT");
        lockActor();
        now=now.plusSeconds(31);
        assertThat(worker.poll()).isEqualTo(1);
        assertThat(state(f.message())).isEqualTo("FAILED");
        unlockActor();
        return f;
    }

    @Test void transient_failures_wait_30s_then_120s_then_fail_at_limit() {
        var f=queue();
        when(transport.submit(any())).thenReturn(TRANSIENT);
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(f.message())).isEqualTo("RETRY_WAIT");
        assertThat(attempts(f.message())).isEqualTo(1);
        assertThat(worker.poll()).isZero();
        now=now.plusSeconds(31);
        assertThat(worker.poll()).isEqualTo(1);
        assertThat(state(f.message())).isEqualTo("RETRY_WAIT");
        assertThat(attempts(f.message())).isEqualTo(2);
        now=now.plusSeconds(119);
        assertThat(worker.poll()).isZero();
        now=now.plusSeconds(2);
        assertThat(worker.poll()).isEqualTo(1);
        assertThat(state(f.message())).isEqualTo("FAILED");
        assertThat(attempts(f.message())).isEqualTo(3);
        verify(transport,times(3)).submit(any());
        now=now.plusSeconds(3600);
        assertThat(worker.poll()).isZero();
        verifyNoMoreInteractions(transport);
    }

    @Test void permanent_failure_never_retries() {
        var f=queue();
        when(transport.submit(any())).thenReturn(PERMANENT);
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(f.message())).isEqualTo("FAILED");
        now=now.plusSeconds(3600);
        assertThat(worker.poll()).isZero();
        verify(transport,times(1)).submit(any());
    }

    @Test void manual_retry_requeues_failed_transient_message_with_key_reuse() {
        var f=failedWithOneAttempt();
        UUID key=UUID.randomUUID();
        var first=post("/api/core/messages/"+f.message()+"/retry",token,body("retryRequestId",key),"retained-manual-trace");
        assertThat(first.getStatusCode().value()).isEqualTo(202);
        assertThat(state(f.message())).isEqualTo("QUEUED");
        var replay=post("/api/core/messages/"+f.message()+"/retry",token,body("retryRequestId",key),"retained-manual-trace");
        assertThat(replay.getStatusCode().value()).isEqualTo(200);
        assertThat(replay.getBody().path("replayed").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from message_retry_requests where message_id=?",Long.class,f.message())).isEqualTo(1);
        when(transport.submit(any())).thenReturn(EmailSubmissionResult.accepted());
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(f.message())).isEqualTo("SMTP_ACCEPTED");
        assertThat(attempts(f.message())).isEqualTo(2);
    }

    @Test void manual_retry_rejects_conflicting_actor_and_wrong_states_and_limits() {
        var f=failedWithOneAttempt();
        String other="retry-other-"+UUID.randomUUID().toString().substring(0,12);
        createUser(other,"password123","ACCOUNTING");
        long otherId=jdbc.queryForObject("select id from users where username=?",Long.class,other);
        actors.add(otherId);
        String otherToken=login(other,"password123");
        UUID key=UUID.randomUUID();
        assertThat(post("/api/core/messages/"+f.message()+"/retry",otherToken,body("retryRequestId",key),"retained-other-trace").getStatusCode().value()).isEqualTo(202);
        assertThat(post("/api/core/messages/"+f.message()+"/retry",token,body("retryRequestId",key),"retained-other-trace").getStatusCode().value()).isEqualTo(409);

        var accepted=queue();
        when(transport.submit(any())).thenReturn(EmailSubmissionResult.accepted());
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(f.message())).isEqualTo("SMTP_ACCEPTED");
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(accepted.message())).isEqualTo("SMTP_ACCEPTED");
        assertThat(post("/api/core/messages/"+accepted.message()+"/retry",token,
                body("retryRequestId",UUID.randomUUID()),"retained-accepted-retry").getStatusCode().value()).isEqualTo(409);

        var exhausted=queue();
        when(transport.submit(any())).thenReturn(TRANSIENT);
        assertThat(worker.dispatchOne()).isTrue();
        now=now.plusSeconds(31);
        assertThat(worker.poll()).isEqualTo(1);
        now=now.plusSeconds(121);
        assertThat(worker.poll()).isEqualTo(1);
        assertThat(state(exhausted.message())).isEqualTo("FAILED");
        assertThat(post("/api/core/messages/"+exhausted.message()+"/retry",token,
                body("retryRequestId",UUID.randomUUID()),"retained-limit-retry").getStatusCode().value()).isEqualTo(409);
    }

    @Test void manual_retry_rejects_changed_business_snapshot() {
        var f=failedWithOneAttempt();
        String collectTrace="retained-snapshot-trace";
        var collected=post("/api/core/receivables/"+f.receivable()+"/collect",token,
                body("amount",20,"collectedOn",LocalDate.now(Clock.fixed(now,SEOUL)).toString(),"requestId",UUID.randomUUID()),collectTrace);
        assertThat(collected.getStatusCode().value()).isEqualTo(200);
        assertThat(post("/api/core/messages/"+f.message()+"/retry",token,
                body("retryRequestId",UUID.randomUUID()),"retained-stale-retry").getStatusCode().value()).isEqualTo(409);
    }

    @Test void retry_endpoint_enforces_roles_and_activation() {
        var f=failedWithOneAttempt();
        String sales="retry-sales-"+UUID.randomUUID().toString().substring(0,12);
        createUser(sales,"password123","SALES");
        long salesId=jdbc.queryForObject("select id from users where username=?",Long.class,sales);
        actors.add(salesId);
        String salesToken=login(sales,"password123");
        assertThat(post("/api/core/messages/"+f.message()+"/retry",salesToken,
                body("retryRequestId",UUID.randomUUID()),"retained-sales-retry").getStatusCode().value()).isEqualTo(403);
        assertThat(post("/api/core/messages/"+f.message()+"/retry",
                body("retryRequestId",UUID.randomUUID())).getStatusCode().value()).isEqualTo(401);
        properties.setEnabled(false);
        try {
            assertThat(post("/api/core/messages/"+f.message()+"/retry",token,
                    body("retryRequestId",UUID.randomUUID()),"retained-disabled-retry").getStatusCode().value()).isEqualTo(503);
        } finally {
            properties.setEnabled(true);
        }
        assertThat(post("/api/core/messages/00000000-0000-0000-0000-000000000000/retry",token,
                body("retryRequestId",UUID.randomUUID()),"retained-missing-retry").getStatusCode().value()).isEqualTo(404);
    }
}
