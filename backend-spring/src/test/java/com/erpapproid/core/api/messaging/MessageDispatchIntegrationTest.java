package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.erpapproid.core.domain.messaging.DeliveryOutcome;
import com.erpapproid.core.support.IntegrationTestSupport;

@TestPropertySource(properties={"erp.messaging.email.enabled=true", "erp.messaging.email.scheduling-enabled=false"})
class MessageDispatchIntegrationTest extends IntegrationTestSupport {
    private static final Instant NOW=Instant.parse("2026-10-04T14:00:00Z");
    private static final ZoneId SEOUL=ZoneId.of("Asia/Seoul");
    @Autowired JdbcTemplate jdbc;
    @Autowired MessageDispatchService worker;
    @Autowired EmailDeliveryProperties properties;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean(name="messageClock") Clock clock;
    @MockitoBean EmailTransport transport;
    private final List<Long> partners=new ArrayList<>();
    private final List<Long> actors=new ArrayList<>();
    private Instant now;
    private String token;
    private long actor;

    record Fixture(long partner, long receivable, long contact, UUID message) {}

    @BeforeEach void setup() {
        now=NOW; properties.setEnabled(true);
        when(clock.instant()).thenAnswer(invocation->now);
        when(clock.withZone(SEOUL)).thenAnswer(invocation->Clock.fixed(now,SEOUL));
        String username="worker-"+UUID.randomUUID().toString().substring(0,12);
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
        String key="DW-"+UUID.randomUUID().toString().substring(0,12);
        long partner=jdbc.queryForObject("insert into partners(partner_no,name,partner_type) values(?,'Synthetic worker customer','고객사') returning id",Long.class,key);
        partners.add(partner);
        long receivable=jdbc.queryForObject("insert into receivables(receivable_no,customer_id,amount,collected_amount,due_date,status) values(?,?,100,30,?,'미수') returning id",Long.class,key,partner,LocalDate.now(Clock.fixed(now,SEOUL)).minusDays(3));
        long contact=jdbc.queryForObject("insert into partner_message_contacts(partner_id,email,permission,confirmation_note,confirmed_by,confirmed_at) values(?,'synthetic@example.invalid','ALLOWED','Synthetic permission',?,now()) returning id",Long.class,partner,actor);
        String path="/api/core/receivables/"+receivable;
        var preview=get(path+"/reminder-preview",token).getBody();
        UUID message=UUID.randomUUID();
        assertThat(post(path+"/reminders",token,body("requestId",message,"contactId",contact,
                "expectedSnapshotHash",preview.path("snapshotHash").asText(),"note","","acknowledged",true),"retained-worker-trace").getStatusCode().value()).isEqualTo(202);
        return new Fixture(partner,receivable,contact,message);
    }

    private String state(UUID id) {
        return jdbc.queryForObject("select state from outbound_messages where id=?",String.class,id);
    }
    private long attempts(UUID id) {
        return jdbc.queryForObject("select count(*) from message_delivery_attempts where message_id=?",Long.class,id);
    }

    @Test void multiple_workers_submit_a_single_committed_attempt_without_request_authentication() throws Exception {
        var f=queue();
        when(transport.submit(any())).thenAnswer(invocation->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(state(f.message())).isEqualTo("DISPATCHING");
            assertThat(attempts(f.message())).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from audit_logs where entity_no=? and action='DISPATCH'",Long.class,f.message().toString().replace("-",""))).isEqualTo(1);
            return EmailSubmissionResult.accepted();
        });
        var gate=new CountDownLatch(1);
        var first=CompletableFuture.supplyAsync(()->{await(gate);return worker.dispatchOne();});
        var second=CompletableFuture.supplyAsync(()->{await(gate);return worker.dispatchOne();});
        gate.countDown();
        assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        verify(transport).submit(any());
        assertThat(state(f.message())).isEqualTo("SMTP_ACCEPTED");
        assertThat(jdbc.queryForObject("select actor_id from message_delivery_attempts where message_id=?",Long.class,f.message())).isEqualTo(actor);
        assertThat(jdbc.queryForObject("select trace_id from message_delivery_attempts where message_id=?",String.class,f.message())).isEqualTo("retained-worker-trace");
        assertThat(jdbc.queryForObject("select count(*) from audit_logs where entity_no=? and (actor_id<>? or trace_id<>'retained-worker-trace')",Long.class,f.message().toString().replace("-",""),actor)).isZero();
    }

    @Test void locked_queue_rows_are_skipped_instead_of_blocking_other_workers() throws Exception {
        var first=queue(); var second=queue();
        var locked=new CountDownLatch(1);var release=new CountDownLatch(1);
        var holder=CompletableFuture.runAsync(()->new TransactionTemplate(transactionManager).executeWithoutResult(status->{
            jdbc.queryForObject("select id from outbound_messages where id=? for update",UUID.class,first.message());
            locked.countDown();await(release);
        }));
        try {
            await(locked);
            var claim=worker.claimOne().orElseThrow();
            assertThat(claim.messageId()).isEqualTo(second.message());
            assertThat(claim.until()).isEqualTo(NOW.plusSeconds(120));
            assertThat(state(first.message())).isEqualTo("QUEUED");
            assertThat(worker.preflight(claim).orElseThrow().smtpMessageId()).isEqualTo("<"+second.message()+"@erp.approid.team>");
        } finally { release.countDown();holder.get(20,TimeUnit.SECONDS); }
        verifyNoInteractions(transport);
    }

    @ParameterizedTest
    @ValueSource(strings={"balance","address","permission","customer","deadline","referenceDate"})
    void changed_business_snapshots_are_stale_without_transport_calls(String change) {
        var f=queue();
        switch(change) {
            case "balance" -> jdbc.update("update receivables set collected_amount=60 where id=?",f.receivable());
            case "address" -> jdbc.update("update partner_message_contacts set email='changed@example.invalid',version=version+1 where id=?",f.contact());
            case "permission" -> jdbc.update("update partner_message_contacts set permission='BLOCKED',version=version+1 where id=?",f.contact());
            case "customer" -> jdbc.update("update partners set name='Changed synthetic customer' where id=?",f.partner());
            case "deadline" -> now=NOW.plusSeconds(901);
            case "referenceDate" -> {
                jdbc.update("update outbound_messages set expires_at=? where id=?",java.sql.Timestamp.from(NOW.plusSeconds(7200)),f.message());
                now=Instant.parse("2026-10-04T15:01:00Z");
            }
            default -> throw new IllegalArgumentException();
        }
        assertThat(worker.dispatchOne()).isTrue();
        assertThat(state(f.message())).isEqualTo("STALE");
        assertThat(jdbc.queryForObject("select error_code from outbound_messages where id=?",String.class,f.message()))
                .isEqualTo(change.equals("deadline")?"MESSAGE_EXPIRED":"SNAPSHOT_CHANGED");
        assertThat(attempts(f.message())).isZero();verifyNoInteractions(transport);
    }

    @ParameterizedTest @ValueSource(strings={"role","locked","retired"})
    void current_actor_permissions_are_rechecked_without_old_jwt_authority(String change) {
        var f=queue();
        if(change.equals("role"))jdbc.update("delete from user_roles where user_id=?",actor);
        else jdbc.update("update users set status=? where id=?",change.equals("retired")?"퇴사":"잠김",actor);
        assertThat(worker.dispatchOne()).isTrue();assertThat(state(f.message())).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("select error_code from outbound_messages where id=?",String.class,f.message())).isEqualTo("ACTOR_NOT_AUTHORIZED");
        verifyNoInteractions(transport);
    }

    @Test void wrong_tokens_and_expired_leases_cannot_start_transmission() {
        var f=queue();var claim=worker.claimOne().orElseThrow();
        var wrong=new MessageClaimRepository.Claim(claim.messageId(),UUID.randomUUID(),claim.until(),claim.receivableId(),claim.partnerId(),claim.actorId(),claim.traceId());
        assertThat(worker.preflight(wrong)).isEmpty();
        now=NOW.plusSeconds(120);
        assertThat(worker.preflight(claim)).isEmpty();
        assertThat(state(f.message())).isEqualTo("CLAIMED");
        assertThat(attempts(f.message())).isZero();verifyNoInteractions(transport);
    }

    @Test void audit_failure_rolls_back_preflight_before_any_external_call() {
        var f=queue();
        jdbc.execute("create function test_dispatch_audit_fail() returns trigger as $$ begin if NEW.action='DISPATCH' then raise exception 'Synthetic dispatch audit failure'; end if; return NEW; end; $$ language plpgsql");
        jdbc.execute("create trigger test_dispatch_audit_fail before insert on audit_logs for each row execute function test_dispatch_audit_fail()");
        try {
            assertThatThrownBy(()->worker.dispatchOne()).isInstanceOf(RuntimeException.class);
            assertThat(state(f.message())).isEqualTo("CLAIMED");assertThat(attempts(f.message())).isZero();
            verifyNoInteractions(transport);
        } finally {
            jdbc.execute("drop trigger test_dispatch_audit_fail on audit_logs");jdbc.execute("drop function test_dispatch_audit_fail()");
        }
    }

    @Test void collections_can_commit_while_the_transport_is_running() {
        var f=queue();
        when(transport.submit(any())).thenAnswer(invocation->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            var collection=CompletableFuture.supplyAsync(()->post("/api/core/receivables/"+f.receivable()+"/collect",token,
                    body("amount",20,"collectedOn",LocalDate.now(SEOUL),"requestId",UUID.randomUUID())));
            assertThat(collection.get(10,TimeUnit.SECONDS).getStatusCode().value()).isEqualTo(200);
            assertThat(jdbc.queryForObject("select collected_amount from receivables where id=?",Long.class,f.receivable())).isEqualTo(50);
            assertThat(((EmailSubmission)invocation.getArgument(0)).body()).contains("70원");
            return EmailSubmissionResult.accepted();
        });
        assertThat(worker.dispatchOne()).isTrue();assertThat(state(f.message())).isEqualTo("SMTP_ACCEPTED");
    }

    @Test void result_finalization_requires_the_matching_token_and_is_single_use() {
        var f=queue();var claim=worker.claimOne().orElseThrow();worker.preflight(claim).orElseThrow();
        var wrong=new MessageClaimRepository.Claim(claim.messageId(),UUID.randomUUID(),claim.until(),claim.receivableId(),claim.partnerId(),claim.actorId(),claim.traceId());
        assertThat(worker.finalizeSubmission(wrong,EmailSubmissionResult.accepted())).isFalse();
        assertThat(state(f.message())).isEqualTo("DISPATCHING");
        assertThat(worker.finalizeSubmission(claim,EmailSubmissionResult.accepted())).isTrue();
        assertThat(worker.finalizeSubmission(claim,EmailSubmissionResult.accepted())).isFalse();
        assertThat(jdbc.queryForObject("select outcome from message_delivery_attempts where message_id=?",String.class,f.message())).isEqualTo("ACCEPTED");
        verifyNoInteractions(transport);
    }

    @Test void disabled_dispatch_does_not_claim_or_call_transport_and_ambient_transactions_are_rejected() {
        var f=queue();properties.setEnabled(false);
        assertThat(worker.poll()).isZero();assertThat(worker.claimOne()).isEmpty();
        assertThat(state(f.message())).isEqualTo("QUEUED");verifyNoInteractions(transport);
        properties.setEnabled(true);
        new TransactionTemplate(transactionManager).executeWithoutResult(status->
                assertThatThrownBy(()->worker.dispatchOne()).isInstanceOf(IllegalStateException.class));
    }

    @Test void unexpected_transport_errors_are_unknown_and_never_automatically_resent() {
        var f=queue();when(transport.submit(any())).thenThrow(new IllegalStateException("Synthetic private transport detail"));
        assertThat(worker.dispatchOne()).isTrue();assertThat(state(f.message())).isEqualTo("UNKNOWN");
        assertThat(jdbc.queryForObject("select error_code from outbound_messages where id=?",String.class,f.message())).isEqualTo("TRANSPORT_EXCEPTION");
        clearInvocations(transport);assertThat(worker.poll()).isZero();verifyNoInteractions(transport);
    }

    @Test void polls_are_bounded_and_claim_each_message_only_immediately_before_submission() {
        for(int i=0;i<11;i++)queue();
        when(transport.submit(any())).thenAnswer(invocation->{
            assertThat(jdbc.queryForObject("select count(*) from outbound_messages where state='CLAIMED'",Long.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from outbound_messages where state='DISPATCHING'",Long.class)).isEqualTo(1);
            return EmailSubmissionResult.accepted();
        });
        assertThat(worker.poll()).isEqualTo(10);verify(transport,times(10)).submit(any());
        assertThat(jdbc.queryForObject("select count(*) from outbound_messages where state='QUEUED'",Long.class)).isEqualTo(1);
        assertThat(worker.poll()).isEqualTo(1);verify(transport,times(11)).submit(any());
        assertThat(worker.poll()).isZero();
    }

    private static void await(CountDownLatch gate) {
        try { if(!gate.await(15,TimeUnit.SECONDS))throw new IllegalStateException("Test gate timeout"); }
        catch(InterruptedException ex) { Thread.currentThread().interrupt();throw new IllegalStateException(ex); }
    }
}
