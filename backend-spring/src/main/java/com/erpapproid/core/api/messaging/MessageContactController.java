package com.erpapproid.core.api.messaging;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/core/partners/{id}/message-contacts/receivable-reminder")
@RequiredArgsConstructor
public class MessageContactController {
    private final MessageContactService service;
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTING','SALES')")
    public MessageContactDto.State get(@PathVariable Long id) { return service.get(id); }
    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTING')")
    @Transactional
    public org.springframework.http.ResponseEntity<MessageContactDto.Response> put(@PathVariable Long id, @Valid @RequestBody MessageContactDto.Request input) {
        var result = service.put(id, input);
        return org.springframework.http.ResponseEntity.status(result.created() ? 201 : 200).body(result.contact());
    }
}
