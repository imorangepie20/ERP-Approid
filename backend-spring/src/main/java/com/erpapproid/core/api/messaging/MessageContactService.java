package com.erpapproid.core.api.messaging;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.messaging.MessageChannel;
import com.erpapproid.core.domain.messaging.MessagePermission;
import com.erpapproid.core.domain.messaging.MessagePurpose;
import com.erpapproid.core.domain.messaging.PartnerMessageContactEntity;
import com.erpapproid.core.domain.messaging.PartnerMessageContactRepository;
import com.erpapproid.core.domain.partner.PartnerRepository;
import com.erpapproid.core.security.CurrentActorProvider;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MessageContactService {
    private final PartnerRepository partners;
    private final PartnerMessageContactRepository contacts;
    private final CurrentActorProvider actors;
    private final AuditService audit;

    @Transactional(readOnly=true)
    public MessageContactDto.State get(Long partnerId) {
        if (!partners.existsById(partnerId)) throw new DomainException(ErrorCode.NOT_FOUND, "거래처를 찾을 수 없습니다.");
        return new MessageContactDto.State(MessageContactDto.response(contacts.findByPartner_IdAndPurposeAndChannel(
                partnerId, MessagePurpose.RECEIVABLE_REMINDER, MessageChannel.EMAIL).orElse(null)));
    }

    @Transactional
    public PutResult put(Long partnerId, MessageContactDto.Request input) {
        String email = EmailAddresses.normalize(input.email());
        String note = input.confirmationNote() == null ? null : input.confirmationNote().trim();
        if (input.permission() == MessagePermission.ALLOWED && (!input.acknowledged() || note == null || note.isBlank())) {
            throw new DomainException(ErrorCode.INVALID_INPUT, "발송 허용에는 새로운 확인 체크와 확인 근거가 필요합니다.");
        }
        long actor = actors.currentActorId().orElseThrow(() -> new DomainException(ErrorCode.UNAUTHORIZED, "인증이 필요합니다."));
        var partner = partners.findForUpdate(partnerId).orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND, "거래처를 찾을 수 없습니다."));
        var contact = contacts.findForUpdate(partnerId, MessagePurpose.RECEIVABLE_REMINDER, MessageChannel.EMAIL).orElse(null);
        boolean created = contact == null;
        if ((contact == null && input.expectedVersion() != null)
                || (contact != null && !Objects.equals(contact.getVersion(), input.expectedVersion()))) {
            throw new DomainException(ErrorCode.DUPLICATE, "연락처가 변경되었습니다. 다시 조회하고 확인하세요.");
        }
        var before = contact == null ? Map.of("registered", false) : auditSnapshot(contact);
        if (contact == null) contact = PartnerMessageContactEntity.builder().partner(partner).email(email).build();
        contact.revise(email, input.permission(), note, actor, Instant.now());
        contact = contacts.saveAndFlush(contact);
        audit.record(AuditEvent.sensitiveChange("CONTACT_UPDATE", "MESSAGE_CONTACT", partner.getPartnerNo(), before, auditSnapshot(contact)));
        return new PutResult(MessageContactDto.response(contact), created);
    }
    public record PutResult(MessageContactDto.Response contact, boolean created) {}
    private Map<String,Object> auditSnapshot(PartnerMessageContactEntity contact) {
        return Map.of("id", contact.getId(), "version", contact.getVersion(), "permission", contact.getPermission());
    }
}
