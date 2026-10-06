package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Properties;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.OptimisticLockException;

import com.erpapproid.core.domain.messaging.DeliveryOutcome;
import com.erpapproid.core.domain.messaging.MessageChannel;
import com.erpapproid.core.domain.messaging.MessageDeliveryAttemptEntity;
import com.erpapproid.core.domain.messaging.MessageDeliveryAttemptRepository;
import com.erpapproid.core.domain.messaging.MessagePermission;
import com.erpapproid.core.domain.messaging.MessagePurpose;
import com.erpapproid.core.domain.messaging.MessageRetryRequestEntity;
import com.erpapproid.core.domain.messaging.MessageRetryRequestRepository;
import com.erpapproid.core.domain.messaging.MessageState;
import com.erpapproid.core.domain.messaging.OutboundMessageEntity;
import com.erpapproid.core.domain.messaging.OutboundMessageRepository;
import com.erpapproid.core.domain.messaging.PartnerMessageContactEntity;
import com.erpapproid.core.domain.messaging.PartnerMessageContactRepository;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.sales.ReceivableEntity;
import com.erpapproid.core.support.IntegrationTestSupport;

class MessageSchemaIntegrationTest extends IntegrationTestSupport {
    private static final String HASH = "a".repeat(64);
    private static final Instant REQUESTED_AT = Instant.parse("2026-10-04T03:00:00Z");

    @Autowired private EntityManager entityManager;
    @Autowired private PartnerMessageContactRepository contacts;
    @Autowired private OutboundMessageRepository messages;
    @Autowired private MessageDeliveryAttemptRepository attempts;
    @Autowired private MessageRetryRequestRepository retries;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void upgrades_v18_without_changing_financial_or_generic_contact_data() {
        try (var database = new MigrationDatabase()) {
            database.flyway("18").migrate();
            var jdbc = database.jdbc;
            jdbc.update("update partners set contact='generic-contact-only' where id=1");
            long receivable = jdbc.queryForObject("""
                    insert into receivables(receivable_no,customer_id,amount,collected_amount,due_date,status)
                    values('EMAIL-MIG',1,2000,500,'2026-01-02','미수') returning id
                    """, Long.class);
            jdbc.update("""
                    insert into receivable_collections(receivable_id,request_id,amount,collected_on,
                        remaining_amount,actor_id,trace_id)
                    values(?,?,500,'2026-01-01',1500,1,'email-migration')
                    """, receivable, UUID.randomUUID());
            var receivablesBefore = jdbc.queryForList("select * from receivables order by id");
            var collectionsBefore = jdbc.queryForList("select * from receivable_collections order by id");
            var partnersBefore = jdbc.queryForList("select * from partners order by id");

            var flyway = database.flyway(null);
            assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);
            flyway.validate();
            for (String table : List.of("partner_message_contacts", "outbound_messages",
                    "message_delivery_attempts", "message_retry_requests")) {
                assertThat(jdbc.queryForObject("select count(*) from " + table, Long.class)).isZero();
            }
            assertThat(jdbc.queryForList("select * from receivables order by id")).isEqualTo(receivablesBefore);
            assertThat(jdbc.queryForList("select * from receivable_collections order by id")).isEqualTo(collectionsBefore);
            assertThat(jdbc.queryForList("select * from partners order by id")).isEqualTo(partnersBefore);
            assertThat(flyway.migrate().migrationsExecuted).isZero();
        }
    }

    @Test
    void contact_defaults_and_constraints_do_not_infer_delivery_permission() {
        try (var database = migratedDatabase()) {
            var jdbc = database.jdbc;
            long contact = jdbc.queryForObject("""
                    insert into partner_message_contacts(partner_id,email)
                    values(1,'fixture@example.invalid') returning id
                    """, Long.class);
            assertThat(jdbc.queryForObject("select permission from partner_message_contacts where id=?",
                    String.class, contact)).isEqualTo("PENDING");
            reject(() -> jdbc.update("update partner_message_contacts set permission='ALLOWED' where id=?", contact));
            reject(() -> jdbc.update("""
                    update partner_message_contacts set permission='ALLOWED', confirmation_note=' ',
                        confirmed_by=1,confirmed_at=now() where id=?
                    """, contact));
            jdbc.update("""
                    update partner_message_contacts set permission='ALLOWED',confirmation_note='Synthetic approval',
                        confirmed_by=1,confirmed_at=now() where id=?
                    """, contact);
            for (String assignment : List.of("purpose='OTHER'", "channel='SMS'", "permission='OTHER'",
                    "email='two@example.invalid,second@example.invalid'", "email='newline@example.invalid' || chr(10)",
                    "email='한글@example.invalid'", "email='no-at-sign'", "version=-1", "confirmed_by=999999")) {
                reject(() -> jdbc.update("update partner_message_contacts set " + assignment + " where id=?", contact));
            }
            reject(() -> jdbc.update("insert into partner_message_contacts(partner_id,email) values(1,'other@example.invalid')"));
            reject(() -> jdbc.update("insert into partner_message_contacts(partner_id,email) values(999999,'other@example.invalid')"));
            jdbc.update("update partner_message_contacts set permission='BLOCKED' where id=?", contact);
            assertThat(jdbc.queryForObject("select permission from partner_message_contacts where id=?",
                    String.class, contact)).isEqualTo("BLOCKED");
        }
    }

    @Test
    void message_rejects_invalid_identifiers_hashes_money_states_and_references() {
        try (var database = migratedDatabase()) {
            var jdbc = database.jdbc;
            var fixture = fixture(jdbc);
            UUID message = insertMessage(jdbc, fixture);
            for (String assignment : List.of("request_id='" + UUID.randomUUID() + "'", "input_hash='ABC'",
                    "snapshot_hash='" + "A".repeat(64) + "'", "state='DELIVERED'", "amount=0",
                    "collected_amount=-1", "remaining_amount=0", "remaining_amount=2000", "contact_version=-1",
                    "contact_permission='BLOCKED'", "attempt_count=4", "attempt_count=-1", "actor_id=999999",
                    "receivable_id=999999", "partner_id=999999", "contact_id=999999", "version=-1",
                    "expires_at=requested_at", "recipient='invalid'", "subject='header' || chr(13)",
                    "smtp_message_id='header' || chr(10)", "trace_id=' '", "error_code='raw smtp details'")) {
                reject(() -> jdbc.update("update outbound_messages set " + assignment + " where id=?", message));
            }
            assertThat(jdbc.queryForObject("select state from outbound_messages where id=?", String.class, message))
                    .isEqualTo("QUEUED");
            assertThat(jdbc.queryForObject("select attempt_count from outbound_messages where id=?", Integer.class, message))
                    .isZero();
            assertThat(jdbc.queryForList("select indexname from pg_indexes where schemaname=? and tablename='outbound_messages'",
                    String.class, database.schema)).contains("idx_message_poll", "idx_message_history", "uq_message_active_receivable");
        }
    }

    @Test
    void active_unique_includes_unknown_and_daily_acceptance_uses_seoul_date() {
        try (var database = migratedDatabase()) {
            var jdbc = database.jdbc;
            var fixture = fixture(jdbc);
            UUID first = insertMessage(jdbc, fixture);
            for (String state : List.of("QUEUED", "CLAIMED", "DISPATCHING", "RETRY_WAIT", "UNKNOWN")) {
                jdbc.update("update outbound_messages set state=? where id=?", state, first);
                reject(() -> insertMessage(jdbc, fixture));
            }
            jdbc.update("update outbound_messages set state='FAILED' where id=?", first);
            UUID second = insertMessage(jdbc, fixture);
            reject(() -> jdbc.update("update outbound_messages set state='UNKNOWN' where id=?", first));
            jdbc.update("update outbound_messages set state='STALE' where id=?", second);
            reject(() -> jdbc.update("update outbound_messages set state='SMTP_ACCEPTED' where id=?", first));
            reject(() -> jdbc.update("""
                    update outbound_messages set state='SMTP_ACCEPTED',accepted_at='2026-10-04T16:00:00Z',
                        accepted_on='2026-10-04' where id=?
                    """, first));
            jdbc.update("""
                    update outbound_messages set state='SMTP_ACCEPTED',accepted_at='2026-10-04T16:00:00Z',
                        accepted_on='2026-10-05' where id=?
                    """, first);
            UUID third = insertMessage(jdbc, fixture);
            reject(() -> jdbc.update("""
                    update outbound_messages set state='SMTP_ACCEPTED',accepted_at='2026-10-04T17:00:00Z',
                        accepted_on='2026-10-05' where id=?
                    """, third));
            jdbc.update("""
                    update outbound_messages set state='SMTP_ACCEPTED',accepted_at='2026-10-05T17:00:00Z',
                        accepted_on='2026-10-06' where id=?
                    """, third);
            insertMessage(jdbc, fixture);
        }
    }

    @Test
    void attempts_and_retry_keys_preserve_history_and_limit_safe_values() {
        try (var database = migratedDatabase()) {
            var jdbc = database.jdbc;
            var fixture = fixture(jdbc);
            UUID message = insertMessage(jdbc, fixture);
            long attempt = jdbc.queryForObject("""
                    insert into message_delivery_attempts(message_id,attempt_number,claim_token,started_at,
                        smtp_message_id,actor_id,trace_id) values(?,1,?,now(),'<synthetic@example.invalid>',1,'test') returning id
                    """, Long.class, message, UUID.randomUUID());
            for (String assignment : List.of("attempt_number=0", "attempt_number=4", "outcome='UNKNOWN'",
                    "finished_at=now()", "actor_id=999999", "message_id='" + UUID.randomUUID() + "'",
                    "error_code='private smtp response'")) {
                reject(() -> jdbc.update("update message_delivery_attempts set " + assignment + " where id=?", attempt));
            }
            reject(() -> jdbc.update("""
                    insert into message_delivery_attempts(message_id,attempt_number,claim_token,started_at,
                        smtp_message_id,actor_id,trace_id) values(?,1,?,now(),'<synthetic@example.invalid>',1,'test')
                    """, message, UUID.randomUUID()));
            jdbc.update("update message_delivery_attempts set finished_at=now(),outcome='UNKNOWN' where id=?", attempt);
            reject(() -> jdbc.update("update message_delivery_attempts set outcome='DELIVERED' where id=?", attempt));
            reject(() -> jdbc.update("update message_delivery_attempts set finished_at=started_at-interval '1 second' where id=?", attempt));
            UUID retry = UUID.randomUUID();
            jdbc.update("""
                    insert into message_retry_requests(id,message_id,actor_id,trace_id,input_hash,requested_at)
                    values(?,?,1,'retry-test',?,now())
                    """, retry, message, HASH);
            reject(() -> jdbc.update("""
                    insert into message_retry_requests(id,message_id,actor_id,trace_id,input_hash,requested_at)
                    values(?,?,1,'retry-test',?,now())
                    """, retry, message, HASH));
            reject(() -> jdbc.update("update message_retry_requests set input_hash='bad' where id=?", retry));
            reject(() -> jdbc.update("update message_retry_requests set actor_id=999999 where id=?", retry));
            reject(() -> jdbc.update("update message_retry_requests set message_id=? where id=?", UUID.randomUUID(), retry));
            reject(() -> jdbc.update("delete from outbound_messages where id=?", message));
            reject(() -> jdbc.update("delete from partner_message_contacts where id=?", fixture.contactId));
            reject(() -> jdbc.update("delete from receivables where id=?", fixture.receivableId));
            reject(() -> jdbc.update("delete from partners where id=1"));
            assertThat(jdbc.queryForObject("""
                    select count(*) from pg_constraint where connamespace=?::regnamespace
                        and contype='f' and conrelid in ('partner_message_contacts'::regclass,
                        'outbound_messages'::regclass,'message_delivery_attempts'::regclass,'message_retry_requests'::regclass)
                        and confdeltype <> 'a'
                    """, Long.class, database.schema)).isZero();
        }
    }

    @Test
    @Transactional
    void jpa_round_trips_all_four_models_and_repository_queries() {
        var partner = entityManager.getReference(PartnerEntity.class, 1L);
        var receivable = ReceivableEntity.builder().receivableNo("EMAIL-" + UUID.randomUUID().toString().substring(0, 12))
                .customer(partner).amount(2000L).collectedAmount(500L).dueDate(LocalDate.of(2026, 10, 1))
                .overdueDays(0).status("미수").build();
        entityManager.persist(receivable);
        var contact = contacts.saveAndFlush(PartnerMessageContactEntity.builder().partner(partner)
                .email("fixture@example.invalid").permission(MessagePermission.ALLOWED)
                .confirmationNote("Synthetic approval").confirmedBy(1L).confirmedAt(REQUESTED_AT).build());
        UUID id = UUID.randomUUID();
        var message = messages.saveAndFlush(OutboundMessageEntity.builder().id(id).requestId(id)
                .receivable(receivable).partner(partner).contact(contact).actorId(1L).traceId("jpa-test")
                .inputHash(HASH).snapshotHash(HASH).templateVersion("RECEIVABLE_REMINDER_EMAIL_V1")
                .recipient(contact.getEmail()).subject("Synthetic reminder").body("Synthetic body")
                .note("Synthetic note").receivableNo(receivable.getReceivableNo()).customerName("Synthetic customer")
                .receivableStatus("미수").amount(2000L).collectedAmount(500L).remainingAmount(1500L)
                .dueDate(receivable.getDueDate()).referenceDate(LocalDate.of(2026, 10, 4))
                .contactVersion(contact.getVersion()).contactPermission(MessagePermission.ALLOWED)
                .requestedAt(REQUESTED_AT).expiresAt(REQUESTED_AT.plusSeconds(900))
                .smtpMessageId("<" + id + "@example.invalid>").build());
        UUID token = UUID.randomUUID();
        var attempt = attempts.saveAndFlush(MessageDeliveryAttemptEntity.builder().message(message)
                .attemptNumber(1).claimToken(token).startedAt(REQUESTED_AT).finishedAt(REQUESTED_AT.plusSeconds(1))
                .outcome(DeliveryOutcome.UNKNOWN).errorCode("SUBMISSION_UNCERTAIN")
                .smtpMessageId(message.getSmtpMessageId()).actorId(1L).traceId("jpa-test").build());
        UUID retryId = UUID.randomUUID();
        retries.saveAndFlush(MessageRetryRequestEntity.builder().id(retryId).message(message)
                .actorId(1L).traceId("retry-test").inputHash(HASH).requestedAt(REQUESTED_AT).build());
        entityManager.clear();
        var loadedContact = contacts.findByPartner_IdAndPurposeAndChannel(1L,
                MessagePurpose.RECEIVABLE_REMINDER, MessageChannel.EMAIL).orElseThrow();
        assertThat(loadedContact.getVersion()).isZero();
        assertThat(loadedContact.getCreatedAt()).isNotNull();
        assertThat(loadedContact.getPermission()).isEqualTo(MessagePermission.ALLOWED);
        var loaded = messages.findById(id).orElseThrow();
        assertThat(loaded.getRequestId()).isEqualTo(id);
        assertThat(loaded.getState()).isEqualTo(MessageState.QUEUED);
        assertThat(loaded.getVersion()).isZero();
        assertThat(loaded.getNote()).isEqualTo("Synthetic note");
        assertThat(loaded.getRemainingAmount()).isEqualTo(1500L);
        assertThat(loaded.getReferenceDate()).isEqualTo(LocalDate.of(2026, 10, 4));
        assertThat(loaded.getRequestedAt()).isEqualTo(REQUESTED_AT);
        assertThat(loaded.getContact().getId()).isEqualTo(contact.getId());
        assertThat(messages.findByReceivable_Id(receivable.getId(), PageRequest.of(0, 20)).getTotalElements()).isEqualTo(1);
        var loadedAttempt = attempts.findByMessage_Id(id, PageRequest.of(0, 20)).getContent().getFirst();
        assertThat(loadedAttempt.getId()).isEqualTo(attempt.getId());
        assertThat(loadedAttempt.getOutcome()).isEqualTo(DeliveryOutcome.UNKNOWN);
        assertThat(loadedAttempt.getClaimToken()).isEqualTo(token);
        assertThat(loadedAttempt.getTraceId()).isEqualTo("jpa-test");
        assertThat(retries.findByMessage_Id(id, PageRequest.of(0, 20)).getContent().getFirst().getId()).isEqualTo(retryId);
        assertThat(retries.findById(retryId).orElseThrow().getInputHash()).isEqualTo(HASH);
    }

    @Test
    void contact_version_rejects_a_stale_detached_update() {
        var transaction = new TransactionTemplate(transactionManager);
        var stale = transaction.execute(status -> contacts.saveAndFlush(PartnerMessageContactEntity.builder()
                .partner(entityManager.getReference(PartnerEntity.class, 1L)).email("version@example.invalid").build()));
        try {
            transaction.executeWithoutResult(status -> entityManager.lock(
                    contacts.findById(stale.getId()).orElseThrow(), LockModeType.OPTIMISTIC_FORCE_INCREMENT));
            Integer currentVersion = transaction.execute(status -> contacts.findById(stale.getId()).orElseThrow().getVersion());
            assertThat(currentVersion).isEqualTo(1);
            assertThatThrownBy(() -> transaction.executeWithoutResult(status -> entityManager.merge(stale)))
                    .isInstanceOf(OptimisticLockException.class);
        } finally {
            transaction.executeWithoutResult(status -> contacts.deleteById(stale.getId()));
        }
    }

    private static void reject(Runnable operation) {
        assertThatThrownBy(operation::run).isInstanceOf(DataIntegrityViolationException.class);
    }

    private static MigrationDatabase migratedDatabase() {
        var database = new MigrationDatabase();
        try {
            database.flyway(null).migrate();
            return database;
        } catch (RuntimeException exception) {
            database.close();
            throw exception;
        }
    }

    private static Fixture fixture(JdbcTemplate jdbc) {
        long receivable = jdbc.queryForObject("""
                insert into receivables(receivable_no,customer_id,amount,due_date,status)
                values('EMAIL-FIXTURE',1,1000,'2026-01-02','미수') returning id
                """, Long.class);
        long contact = jdbc.queryForObject("""
                insert into partner_message_contacts(partner_id,email,permission,confirmation_note,confirmed_by,confirmed_at)
                values(1,'fixture@example.invalid','ALLOWED','Synthetic approval',1,now()) returning id
                """, Long.class);
        return new Fixture(receivable, contact);
    }

    private static UUID insertMessage(JdbcTemplate jdbc, Fixture fixture) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into outbound_messages(id,request_id,receivable_id,partner_id,contact_id,actor_id,trace_id,
                    input_hash,snapshot_hash,template_version,recipient,subject,body,receivable_no,customer_name,
                    receivable_status,amount,collected_amount,remaining_amount,due_date,reference_date,
                    contact_version,contact_permission,requested_at,expires_at,smtp_message_id)
                values(?,?,?,1,?,1,'test',?,?,'RECEIVABLE_REMINDER_EMAIL_V1','fixture@example.invalid',
                    'Synthetic reminder','Synthetic body','EMAIL-FIXTURE','Synthetic customer','미수',
                    1000,0,1000,'2026-01-02','2026-10-04',0,'ALLOWED',
                    '2026-10-04T03:00:00Z','2026-10-04T03:15:00Z',?)
                """, id, id, fixture.receivableId, fixture.contactId, HASH, HASH, "<" + id + "@example.invalid>");
        return id;
    }

    private record Fixture(long receivableId, long contactId) {}

    private static final class MigrationDatabase implements AutoCloseable {
        private final String schema = "message_migration_" + UUID.randomUUID().toString().replace("-", "");
        private final DriverManagerDataSource root = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        private final JdbcTemplate jdbc;

        private MigrationDatabase() {
            var connection = new DriverManagerDataSource(
                    POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
            var properties = new Properties();
            properties.setProperty("currentSchema", schema);
            connection.setConnectionProperties(properties);
            jdbc = new JdbcTemplate(connection);
        }

        private Flyway flyway(String target) {
            var configuration = Flyway.configure().dataSource(root).schemas(schema).defaultSchema(schema);
            if (target != null) configuration.target(target);
            return configuration.load();
        }

        @Override
        public void close() {
            if (!schema.matches("message_migration_[a-f0-9]{32}")) {
                throw new IllegalStateException("Unsafe isolated test schema");
            }
            new JdbcTemplate(root).execute("drop schema if exists " + schema + " cascade");
        }
    }
}
