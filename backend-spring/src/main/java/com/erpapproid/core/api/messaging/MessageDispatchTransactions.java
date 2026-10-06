package com.erpapproid.core.api.messaging;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.messaging.MessageChannel;
import com.erpapproid.core.domain.messaging.MessagePermission;
import com.erpapproid.core.domain.messaging.MessagePurpose;
import com.erpapproid.core.domain.messaging.MessageState;
import com.erpapproid.core.domain.messaging.OutboundMessageEntity;
import com.erpapproid.core.domain.messaging.OutboundMessageRepository;
import com.erpapproid.core.domain.messaging.PartnerMessageContactRepository;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.sales.ReceivableRepository;
import com.erpapproid.core.domain.user.UserRepository;

/** Short transactions called through a separate Spring proxy; never calls the transport. */
@Service
public class MessageDispatchTransactions {
    private static final ZoneId SEOUL=ZoneId.of("Asia/Seoul");
    private final MessageClaimRepository claims;
    private final OutboundMessageRepository messages;
    private final ReceivableRepository receivables;
    private final PartnerRepository partners;
    private final PartnerMessageContactRepository contacts;
    private final UserRepository users;
    private final MessageHashes hashes;
    private final AuditService audit;
    private final JdbcTemplate jdbc;
    private final EmailDeliveryProperties properties;
    private final Clock clock;

    public MessageDispatchTransactions(MessageClaimRepository claims, OutboundMessageRepository messages,
            ReceivableRepository receivables, PartnerRepository partners, PartnerMessageContactRepository contacts,
            UserRepository users, MessageHashes hashes, AuditService audit, JdbcTemplate jdbc,
            EmailDeliveryProperties properties, @Qualifier("messageClock") Clock clock) {
        this.claims=claims;this.messages=messages;this.receivables=receivables;this.partners=partners;
        this.contacts=contacts;this.users=users;this.hashes=hashes;this.audit=audit;this.jdbc=jdbc;
        this.properties=properties;this.clock=clock;
    }

    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public Optional<MessageClaimRepository.Claim> claimOne() {
        if(!properties.isEnabled())return Optional.empty();
        var claimed=claims.claimNext(clock.instant());
        claimed.ifPresent(c->audit.recordAsActor(AuditEvent.sensitiveChange("CLAIM","MESSAGE",auditNo(c.messageId()),
                Map.of("state",MessageState.QUEUED),Map.of("state",MessageState.CLAIMED)),c.actorId(),c.traceId()));
        return claimed;
    }

    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public Optional<EmailSubmission> preflight(MessageClaimRepository.Claim claim) {
        if(!properties.isEnabled())return Optional.empty();
        // Same lock order as request/collection/contact writes. The claim transaction
        // only locked the message and ended before any of these business locks.
        var r=receivables.findForUpdate(claim.receivableId()).orElse(null);
        var p=partners.findForUpdate(claim.partnerId()).orElse(null);
        var c=contacts.findForUpdate(claim.partnerId(),MessagePurpose.RECEIVABLE_REMINDER,MessageChannel.EMAIL).orElse(null);
        var m=messages.findForUpdate(claim.messageId()).orElse(null);
        Instant now=clock.instant();
        if(m==null || m.getState()!=MessageState.CLAIMED || !claim.token().equals(m.getClaimToken())
                || m.getClaimUntil()==null || !m.getClaimUntil().isAfter(now))return Optional.empty();
        var actor=users.findById(m.getActorId()).orElse(null);
        if(actor==null || !"활성".equals(actor.getStatus()) || actor.getRoles().stream()
                .noneMatch(role->role.getCode().equals("ADMIN") || role.getCode().equals("ACCOUNTING"))) {
            stop(m,MessageState.FAILED,"ACTOR_NOT_AUTHORIZED");return Optional.empty();
        }
        if(!m.getExpiresAt().isAfter(now)) {
            stop(m,MessageState.STALE,"MESSAGE_EXPIRED");return Optional.empty();
        }
        LocalDate today=LocalDate.ofInstant(now,SEOUL);
        if(r==null || p==null || c==null || !r.getCustomer().getId().equals(p.getId())
                || !m.getReceivable().getId().equals(r.getId()) || !m.getPartner().getId().equals(p.getId())
                || !m.getContact().getId().equals(c.getId()) || c.getPermission()!=MessagePermission.ALLOWED
                || r.getAmount()<=r.getCollectedAmount() || !r.getDueDate().isBefore(today)
                || "수납완료".equals(r.getStatus()) || !m.getSnapshotHash().equals(hashes.snapshot(r,c,today))) {
            stop(m,MessageState.STALE,"SNAPSHOT_CHANGED");return Optional.empty();
        }
        if(m.getAttemptCount()>=3) {
            stop(m,MessageState.FAILED,"ATTEMPT_LIMIT");return Optional.empty();
        }
        int attempt=m.getAttemptCount()+1;
        jdbc.update("""
                INSERT INTO message_delivery_attempts(message_id,attempt_number,claim_token,started_at,
                    smtp_message_id,actor_id,trace_id) VALUES(?,?,?,?,?,?,?)
                """,m.getId(),attempt,m.getClaimToken(),Timestamp.from(now),m.getSmtpMessageId(),m.getActorId(),m.getTraceId());
        jdbc.update("""
                UPDATE outbound_messages SET state='DISPATCHING',attempt_count=?,claim_until=?,
                    error_code=NULL,version=version+1 WHERE id=?
                """,attempt,Timestamp.from(now.plusSeconds(MessageClaimRepository.LEASE_SECONDS)),m.getId());
        record(m,"DISPATCH",MessageState.DISPATCHING,null);
        return Optional.of(new EmailSubmission(m.getId(),m.getRecipient(),m.getSubject(),m.getBody(),m.getSmtpMessageId()));
    }

    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public boolean finalizeSubmission(MessageClaimRepository.Claim claim, EmailSubmissionResult result) {
        var m=messages.findForUpdate(claim.messageId()).orElse(null);
        if(m==null || m.getState()!=MessageState.DISPATCHING || !claim.token().equals(m.getClaimToken()))return false;
        Instant now=clock.instant();
        MessageState target=switch(result.outcome()) {
            case ACCEPTED -> MessageState.SMTP_ACCEPTED;
            case UNKNOWN -> MessageState.UNKNOWN;
            // Retry policy/recovery belong to EMAIL-06. No automatic requeue here.
            case DEFINITELY_NOT_ACCEPTED_TRANSIENT, DEFINITELY_NOT_ACCEPTED_PERMANENT -> MessageState.FAILED;
        };
        String code=result.failure()==null?null:result.failure().name();
        int updated=jdbc.update("""
                UPDATE message_delivery_attempts SET finished_at=?,outcome=?,error_code=?
                WHERE message_id=? AND claim_token=? AND attempt_number=? AND finished_at IS NULL
                """,Timestamp.from(now),result.outcome().name(),code,m.getId(),claim.token(),m.getAttemptCount());
        if(updated!=1)throw new IllegalStateException("Matching unfinished attempt is required");
        jdbc.update("""
                UPDATE outbound_messages SET state=?,error_code=?,accepted_at=?,accepted_on=?,
                    claim_until=NULL,next_attempt_at=NULL,version=version+1 WHERE id=?
                """,target.name(),code,target==MessageState.SMTP_ACCEPTED?Timestamp.from(now):null,
                target==MessageState.SMTP_ACCEPTED?LocalDate.ofInstant(now,SEOUL):null,m.getId());
        record(m,"DISPATCH_RESULT",target,code);
        return true;
    }

    private void stop(OutboundMessageEntity m,MessageState target,String code) {
        jdbc.update("UPDATE outbound_messages SET state=?,error_code=?,claim_until=NULL,version=version+1 WHERE id=?",
                target.name(),code,m.getId());
        record(m,"DISPATCH_BLOCKED",target,code);
    }

    private void record(OutboundMessageEntity m,String action,MessageState target,String code) {
        var after=new java.util.LinkedHashMap<String,Object>();
        after.put("id",m.getId());after.put("state",target);after.put("errorCode",code);
        audit.recordAsActor(AuditEvent.sensitiveChange(action,"MESSAGE",auditNo(m.getId()),
                Map.of("id",m.getId(),"state",m.getState()),after),m.getActorId(),m.getTraceId());
    }

    private static String auditNo(java.util.UUID id) { return id.toString().replace("-",""); }
}
