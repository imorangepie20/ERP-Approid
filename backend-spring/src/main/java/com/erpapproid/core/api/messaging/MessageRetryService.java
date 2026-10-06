package com.erpapproid.core.api.messaging;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.api.sales.ReceivableReminderService;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.web.TraceIdFilter;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.messaging.MessageChannel;
import com.erpapproid.core.domain.messaging.MessageDeliveryAttemptRepository;
import com.erpapproid.core.domain.messaging.MessagePermission;
import com.erpapproid.core.domain.messaging.MessagePurpose;
import com.erpapproid.core.domain.messaging.MessageRetryRequestEntity;
import com.erpapproid.core.domain.messaging.MessageRetryRequestRepository;
import com.erpapproid.core.domain.messaging.MessageState;
import com.erpapproid.core.domain.messaging.OutboundMessageRepository;
import com.erpapproid.core.domain.messaging.PartnerMessageContactRepository;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.sales.ReceivableRepository;
import com.erpapproid.core.domain.user.UserRepository;
import com.erpapproid.core.security.CurrentActorProvider;

/** Manual retry for definitely-unreceived failures. Never resends accepted, stale or unknown messages. */
@Service
public class MessageRetryService {
    private static final ZoneId SEOUL=ZoneId.of("Asia/Seoul");
    private final OutboundMessageRepository messages;
    private final MessageRetryRequestRepository retries;
    private final MessageDeliveryAttemptRepository attempts;
    private final ReceivableRepository receivables;
    private final PartnerRepository partners;
    private final PartnerMessageContactRepository contacts;
    private final UserRepository users;
    private final CurrentActorProvider actors;
    private final AuditService audit;
    private final MessageHashes hashes;
    private final EmailDeliveryProperties properties;
    private final ReceivableReminderService reminders;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public MessageRetryService(OutboundMessageRepository messages, MessageRetryRequestRepository retries,
            MessageDeliveryAttemptRepository attempts,
            ReceivableRepository receivables, PartnerRepository partners, PartnerMessageContactRepository contacts,
            UserRepository users, CurrentActorProvider actors, AuditService audit, MessageHashes hashes,
            EmailDeliveryProperties properties, ReceivableReminderService reminders, JdbcTemplate jdbc,
            @Qualifier("messageClock") Clock clock) {
        this.messages=messages;this.retries=retries;this.attempts=attempts;this.receivables=receivables;this.partners=partners;
        this.contacts=contacts;this.users=users;this.actors=actors;this.audit=audit;this.hashes=hashes;
        this.properties=properties;this.reminders=reminders;this.jdbc=jdbc;this.clock=clock;
    }

    @Transactional
    public MessageDto.Result retry(UUID messageId, MessageDto.RetryRequest input) {
        long actor=actors.currentActorId().orElseThrow(()->new DomainException(ErrorCode.UNAUTHORIZED,"인증이 필요합니다."));
        var previous=retries.findById(input.retryRequestId()).orElse(null);
        if(previous!=null)return replay(previous,messageId,actor);
        if(!properties.isEnabled())throw new DomainException(ErrorCode.UPSTREAM_UNAVAILABLE,"이메일 발송 설정이 비활성입니다.");
        var m=messages.findForUpdate(messageId).orElseThrow(()->new DomainException(ErrorCode.NOT_FOUND,"메시지를 찾을 수 없습니다."));
        previous=retries.findById(input.retryRequestId()).orElse(null);
        if(previous!=null)return replay(previous,messageId,actor);
        if(m.getState()!=MessageState.FAILED || !definitelyUnreceived(m.getId()) || m.getAttemptCount()>=3) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,"확실히 미접수인 재시도 가능 실패만 수동 재시도할 수 있습니다.");
        }
        var requester=users.findById(actor).orElse(null);
        if(requester==null || !"활성".equals(requester.getStatus()) || requester.getRoles().stream()
                .noneMatch(role->role.getCode().equals("ADMIN") || role.getCode().equals("ACCOUNTING"))) {
            throw new DomainException(ErrorCode.FORBIDDEN,"재시도 권한이 없습니다.");
        }
        Instant now=clock.instant();
        if(!m.getExpiresAt().isAfter(now)) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,"검토가 만료되어 새로 검토해야 합니다.");
        }
        var r=receivables.findForUpdate(m.getReceivable().getId()).orElse(null);
        var p=partners.findForUpdate(m.getPartner().getId()).orElse(null);
        var c=contacts.findForUpdate(m.getPartner().getId(),MessagePurpose.RECEIVABLE_REMINDER,MessageChannel.EMAIL).orElse(null);
        LocalDate today=LocalDate.ofInstant(now,SEOUL);
        if(r==null || p==null || c==null || !m.getReceivable().getId().equals(r.getId())
                || !m.getPartner().getId().equals(p.getId()) || !m.getContact().getId().equals(c.getId())
                || c.getPermission()!=MessagePermission.ALLOWED
                || !m.getSnapshotHash().equals(hashes.snapshot(r,c,today))) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,"미수금 또는 연락처가 변경되어 새로 검토해야 합니다.");
        }
        var fields=new LinkedHashMap<String,Object>();
        fields.put("actorId",actor);fields.put("messageId",messageId.toString());
        fields.put("retryRequestId",input.retryRequestId().toString());
        var record=retries.saveAndFlush(MessageRetryRequestEntity.builder().id(input.retryRequestId()).message(m)
                .actorId(actor).traceId(MDC.get(TraceIdFilter.TRACE_ID_KEY)).inputHash(hashes.hash(fields)).requestedAt(now).build());
        jdbc.update("UPDATE outbound_messages SET state='QUEUED',error_code=NULL,claim_token=NULL,claim_until=NULL,"
                + "next_attempt_at=NULL,version=version+1 WHERE id=?",m.getId());
        var after=new LinkedHashMap<String,Object>();
        after.put("id",m.getId());after.put("state",MessageState.QUEUED);after.put("retryRequestId",record.getId());
        audit.record(AuditEvent.sensitiveChange("RETRY","MESSAGE",m.getId().toString().replace("-",""),
                Map.of("id",m.getId(),"state",m.getState()),after));
        return new MessageDto.Result(reminders.detail(messageId),false);
    }

    private MessageDto.Result replay(MessageRetryRequestEntity previous,UUID messageId,long actor) {
        if(previous.getActorId()!=actor || !previous.getMessage().getId().equals(messageId)) {
            throw new DomainException(ErrorCode.DUPLICATE,"같은 재시도 키의 입력 또는 처리자가 다릅니다.");
        }
        return new MessageDto.Result(reminders.detail(messageId),true);
    }

    private boolean definitelyUnreceived(UUID messageId) {
        var latest=attempts.findByMessage_Id(messageId,
                org.springframework.data.domain.PageRequest.of(0,1,
                        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"attemptNumber")));
        return !latest.isEmpty() && latest.getContent().getFirst().getOutcome()
                == com.erpapproid.core.domain.messaging.DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_TRANSIENT;
    }
}
