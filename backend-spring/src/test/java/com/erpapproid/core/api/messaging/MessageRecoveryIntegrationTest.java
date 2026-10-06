package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
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
import com.erpapproid.core.support.IntegrationTestSupport;

/** EMAIL-06 RED: recoverStale, UNKNOWN late-finalize and retry endpoint do not exist yet. */
@TestPropertySource(properties={"erp.messaging.email.enabled=true", "erp.messaging.email.scheduling-enabled=false", "erp.messaging.email.host=test.invalid", "erp.messaging.email.username=test", "erp.messaging.email.password=test", "erp.messaging.email.from=test@example.invalid", "erp.messaging.email.envelope-from=test@example.invalid"})
class MessageRecoveryIntegrationTest extends IntegrationTestSupport {
    private static final Instant NOW=Instant.parse("2026-10-04T14:00:00Z");
    private static final ZoneId SEOUL=ZoneId.of("Asia/Seoul");
    @Autowired JdbcTemplate jdbc;
    @Autowired MessageDispatchService worker;
    @Autowired MessageDispatchTransactions transactions;
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
        String username="recover-"+UUID.randomUUID().toString().substring(0,12);
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
        String key="RC-"+UUID.randomUUID().toString().substring(0,12);
        long partner=jdbc.queryForObject("insert into partners(partner_no,name,partner_type) values(?,'Recovery customer','고객사') returning id",Long.class,key);
        partners.add(partner);
        long receivable=jdbc.queryForObject("insert into receivables(receivable_no,customer_id,amount,collected_amount,due_date,status) values(?,?,100,30,?,'미수') returning id",Long.class,key,partner,LocalDate.now(Clock.fixed(now,SEOUL)).minusDays(3));
        long contact=jdbc.queryForObject("insert into partner_message_contacts(partner_id,email,permission,confirmation_note,confirmed_by,confirmed_at) values(?,'recovery@example.invalid','ALLOWED','Recovery permission',?,now()) returning id",Long.class,partner,actor);
        String path="/api/core/receivables/"+receivable;
        var preview=get(path+"/reminder-preview",token).getBody();
        UUID message=UUID.randomUUID();
        assertThat(post(path+"/reminders",token,body("requestId",message,"contactId",contact,
                "expectedSnapshotHash",preview.path("snapshotHash").asText(),"note","","acknowledged",true),"retained-recover-trace").getStatusCode().value()).isEqualTo(202);
        return new Fixture(partner,receivable,contact,message);
    }

    private String state(UUID id) {
        return jdbc.queryForObject("select state from outbound_messages where id=?",String.class,id);
    }

    @Test void expired_claim_lease_requeues_without_transport_call() {
        var f=queue();
        var claim=worker.claimOne().orElseThrow();
        assertThat(state(f.message())).isEqualTo("CLAIMED");
        now=now.plusSeconds(MessageClaimRepository.LEASE_SECONDS+1);
        transactions.recoverStale();
        assertThat(state(f.message())).isEqualTo("QUEUED");
        verifyNoInteractions(transport);
        when(transport.submit(any())).thenReturn(EmailSubmissionResult.accepted());
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(f.message())).isEqualTo("SMTP_ACCEPTED");
    }

    @Test void expired_dispatch_becomes_unknown_and_blocks_requests_and_retry() {
        var f=queue();
        var claim=worker.claimOne().orElseThrow();
        assertThat(worker.preflight(claim)).isPresent();
        assertThat(state(f.message())).isEqualTo("DISPATCHING");
        now=now.plusSeconds(MessageClaimRepository.LEASE_SECONDS+1);
        transactions.recoverStale();
        assertThat(state(f.message())).isEqualTo("UNKNOWN");
        verifyNoInteractions(transport);
        var preview=get("/api/core/receivables/"+f.receivable()+"/reminder-preview",token).getBody();
        assertThat(post("/api/core/receivables/"+f.receivable()+"/reminders",token,body("requestId",UUID.randomUUID(),
                "contactId",f.contact(),"expectedSnapshotHash",preview.path("snapshotHash").asText(),"note","","acknowledged",true),"retained-unknown-trace").getStatusCode().value()).isEqualTo(409);
        assertThat(post("/api/core/messages/"+f.message()+"/retry",token,
                body("retryRequestId",UUID.randomUUID()),"retained-unknown-retry").getStatusCode().value()).isEqualTo(409);
    }

    @Test void late_result_with_matching_token_finalizes_once() {
        var f=queue();
        var claim=worker.claimOne().orElseThrow();
        assertThat(worker.preflight(claim)).isPresent();
        now=now.plusSeconds(MessageClaimRepository.LEASE_SECONDS+1);
        transactions.recoverStale();
        assertThat(state(f.message())).isEqualTo("UNKNOWN");
        assertThat(worker.finalizeSubmission(claim,EmailSubmissionResult.accepted())).isTrue();
        assertThat(state(f.message())).isEqualTo("SMTP_ACCEPTED");
        assertThat(worker.finalizeSubmission(claim,EmailSubmissionResult.accepted())).isFalse();
        var wrong=new MessageClaimRepository.Claim(claim.messageId(),UUID.randomUUID(),claim.until(),
                claim.receivableId(),claim.partnerId(),claim.actorId(),claim.traceId(),claim.fromState());
        assertThat(worker.finalizeSubmission(wrong,EmailSubmissionResult.accepted())).isFalse();
    }

    @Test void dispatching_with_valid_lease_is_not_reclaimed() {
        var f=queue();
        var claim=worker.claimOne().orElseThrow();
        assertThat(worker.preflight(claim)).isPresent();
        assertThat(worker.poll()).isZero();
        assertThat(state(f.message())).isEqualTo("DISPATCHING");
        verifyNoInteractions(transport);
    }
}
