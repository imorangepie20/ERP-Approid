package com.erpapproid.core.api.messaging;

import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.erpapproid.core.domain.messaging.MessagePermission;
import com.erpapproid.core.domain.messaging.PartnerMessageContactEntity;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class MessageContactDto {
    private MessageContactDto() {}
    @Schema(name = "MessageContactRequest")
    public record Request(@NotBlank @Size(max=254) String email, @NotNull MessagePermission permission,
            @Min(0) Integer expectedVersion, @Size(max=256) String confirmationNote, boolean acknowledged) {}
    @Schema(name = "MessageContactResponse")
    public record Response(Long id, Long partnerId, String email, MessagePermission permission, Integer version,
            String confirmationNote, Long confirmedBy, Instant confirmedAt) {}
    @Schema(name = "MessageContactState")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record State(Response contact) {}
    public static Response response(PartnerMessageContactEntity c) {
        return c == null ? null : new Response(c.getId(), c.getPartner().getId(), c.getEmail(), c.getPermission(),
                c.getVersion(), c.getConfirmationNote(), c.getConfirmedBy(), c.getConfirmedAt());
    }
}
