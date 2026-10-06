package com.erpapproid.core.api.sales;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.api.messaging.EmailDeliveryProperties;
import com.erpapproid.core.api.messaging.MessageContactDto;
import com.erpapproid.core.api.messaging.MessageDto;
import com.erpapproid.core.api.messaging.MessageHashes;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.web.TraceIdFilter;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.messaging.MessageChannel;
import com.erpapproid.core.domain.messaging.MessagePurpose;
import com.erpapproid.core.domain.messaging.MessagePermission;
import com.erpapproid.core.domain.messaging.MessageState;
import com.erpapproid.core.domain.messaging.OutboundMessageEntity;
import com.erpapproid.core.domain.messaging.OutboundMessageRepository;
import com.erpapproid.core.domain.messaging.PartnerMessageContactRepository;
import com.erpapproid.core.domain.messaging.MessageDeliveryAttemptRepository;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.domain.sales.ReceivableRepository;
import com.erpapproid.core.security.CurrentActorProvider;

@Service
public class ReceivableReminderService {
    public static final Set<MessageState> ACTIVE=Set.of(MessageState.QUEUED,MessageState.CLAIMED,
            MessageState.DISPATCHING,MessageState.RETRY_WAIT,MessageState.UNKNOWN);
    private final ReceivableRepository receivables;
    private final PartnerRepository partners;
    private final PartnerMessageContactRepository contacts;
    private final OutboundMessageRepository messages;
    private final MessageDeliveryAttemptRepository attempts;
    private final CurrentActorProvider actors;
    private final AuditService audit;
    private final MessageHashes hashes;
    private final EmailDeliveryProperties properties;
    private final Clock clock;

    public ReceivableReminderService(ReceivableRepository receivables, PartnerRepository partners,
            PartnerMessageContactRepository contacts, OutboundMessageRepository messages,
            MessageDeliveryAttemptRepository attempts, CurrentActorProvider actors, AuditService audit,
            MessageHashes hashes, EmailDeliveryProperties properties, @Qualifier("messageClock") Clock clock) {
        this.receivables=receivables;this.partners=partners;this.contacts=contacts;this.messages=messages;
        this.attempts=attempts;this.actors=actors;this.audit=audit;this.hashes=hashes;this.properties=properties;this.clock=clock;
    }
    public LocalDate today() { return LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul"))); }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public ReceivableDto.ReminderPreview preview(Long id) {
        var r=receivables.findById(id).orElseThrow(()->missing());
        var c=contacts.findByPartner_IdAndPurposeAndChannel(r.getCustomer().getId(),MessagePurpose.RECEIVABLE_REMINDER,MessageChannel.EMAIL).orElse(null);
        var day=today();
        return new ReceivableDto.ReminderPreview(ReceivableMapper.response(r,day),r.getCustomer().getContactName(),r.getCustomer().getContact(),
                MessageContactDto.response(c),hashes.snapshot(r,c,day),properties.isEnabled(),ReminderEmailTemplate.subject(r),ReminderEmailTemplate.body(r,day,""));
    }

    @Transactional
    public MessageDto.Result request(Long id, MessageDto.Request input) {
        long actor=actors.currentActorId().orElseThrow(()->new DomainException(ErrorCode.UNAUTHORIZED,"인증이 필요합니다."));
        String note=input.note().trim();
        String inputHash=hashes.input(actor,id,input.contactId(),input.expectedSnapshotHash(),note,input.acknowledged());
        var previous=messages.findById(input.requestId()).orElse(null);
        if(previous!=null)return replay(previous,inputHash,actor);
        var r=receivables.findForUpdate(id).orElseThrow(()->missing());
        var partner=partners.findForUpdate(r.getCustomer().getId()).orElseThrow(()->missing());
        var c=contacts.findForUpdate(partner.getId(),MessagePurpose.RECEIVABLE_REMINDER,MessageChannel.EMAIL).orElse(null);
        previous=messages.findById(input.requestId()).orElse(null);
        if(previous!=null)return replay(previous,inputHash,actor);
        if(!properties.isEnabled())throw new DomainException(ErrorCode.UPSTREAM_UNAVAILABLE,"이메일 발송 설정이 비활성입니다.");
        var day=today();
        if(!hashes.snapshot(r,c,day).equals(input.expectedSnapshotHash()))throw conflict("미수금 또는 연락처가 변경되었습니다. 다시 검토하세요.");
        if(c==null || !c.getId().equals(input.contactId()) || c.getPermission()!=MessagePermission.ALLOWED
                || r.getAmount()<=r.getCollectedAmount() || !r.getDueDate().isBefore(day) || "수납완료".equals(r.getStatus())) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION,"날짜 연체 미수와 허용된 등록 연락처가 필요합니다.");
        }
        if(messages.existsByReceivable_IdAndStateIn(id,ACTIVE)
                || messages.existsByReceivable_IdAndStateAndAcceptedOn(id,MessageState.SMTP_ACCEPTED,day)) {
            throw conflict("진행 중이거나 접수 여부가 불명확한 요청 또는 오늘 접수된 메시지가 있습니다.");
        }
        var now=clock.instant();
        UUID key=input.requestId();
        var message=messages.saveAndFlush(OutboundMessageEntity.builder().id(key).requestId(key).receivable(r).partner(partner).contact(c)
                .actorId(actor).traceId(MDC.get(TraceIdFilter.TRACE_ID_KEY)).inputHash(inputHash).snapshotHash(input.expectedSnapshotHash())
                .templateVersion(ReminderEmailTemplate.VERSION).recipient(c.getEmail()).subject(ReminderEmailTemplate.subject(r))
                .body(ReminderEmailTemplate.body(r,day,note)).note(note).receivableNo(r.getReceivableNo()).customerName(partner.getName())
                .receivableStatus(r.getStatus()).amount(r.getAmount()).collectedAmount(r.getCollectedAmount()).remainingAmount(r.getAmount()-r.getCollectedAmount())
                .dueDate(r.getDueDate()).referenceDate(day).contactVersion(c.getVersion()).contactPermission(c.getPermission())
                .requestedAt(now).expiresAt(now.plusSeconds(900)).smtpMessageId("<"+key+"@erp.approid.team>").build());
        // audit_logs.entity_no is VARCHAR(32): removing UUID separators is lossless.
        // Keep the canonical UUID in the queue/API and the audit JSON snapshot.
        String auditNo = key.toString().replace("-", "");
        audit.record(AuditEvent.sensitiveCreated("MESSAGE",auditNo,Map.of("id",key,"state",message.getState(),"snapshotHash",message.getSnapshotHash())));
        return new MessageDto.Result(response(message),false);
    }

    private MessageDto.Result replay(OutboundMessageEntity previous,String inputHash,long actor) {
        if(previous.getActorId()!=actor || !previous.getInputHash().equals(inputHash))throw conflict("같은 요청 키의 입력 또는 처리자가 다릅니다.");
        return new MessageDto.Result(response(previous),true);
    }
    @Transactional(readOnly=true)
    public MessageDto.Response detail(UUID id) { return response(messages.findById(id).orElseThrow(()->missing())); }
    @Transactional(readOnly=true)
    public Page<MessageDto.Summary> history(Long id,int page,int size) {
        if(!receivables.existsById(id))throw missing();
        var paging=MasterListQuery.pageable(page,size,"requestedAt,desc",Set.of("requestedAt"),"id");
        return messages.findByReceivable_Id(id,paging).map(MessageDto::summary);
    }
    private MessageDto.Response response(OutboundMessageEntity m) {
        List<MessageDto.Attempt> history=attempts.findByMessage_Id(m.getId(),PageRequest.of(0,3,Sort.by("attemptNumber"))).stream()
                .map(a->new MessageDto.Attempt(a.getAttemptNumber(),a.getStartedAt(),a.getFinishedAt(),a.getOutcome(),a.getErrorCode())).toList();
        return new MessageDto.Response(m.getId(),m.getReceivable().getId(),m.getState(),m.getRecipient(),m.getSubject(),m.getBody(),
                m.getRemainingAmount(),m.getRequestedAt(),m.getExpiresAt(),m.getNextAttemptAt(),m.getAttemptCount(),m.getAcceptedAt(),m.getErrorCode(),history);
    }
    private static DomainException missing() { return new DomainException(ErrorCode.NOT_FOUND,"미수금 또는 메시지를 찾을 수 없습니다."); }
    private static DomainException conflict(String message) { return new DomainException(ErrorCode.DUPLICATE,message); }
}
