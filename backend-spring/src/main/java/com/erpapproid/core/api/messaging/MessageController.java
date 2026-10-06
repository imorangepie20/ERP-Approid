package com.erpapproid.core.api.messaging;

import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.erpapproid.core.api.sales.ReceivableReminderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/core/messages")
@RequiredArgsConstructor
public class MessageController {
    private final ReceivableReminderService reminders;
    private final MessageRetryService retries;
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTING','SALES')")
    public MessageDto.Response detail(@PathVariable UUID id) { return reminders.detail(id); }
    @PostMapping("/{id}/retry")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTING')")
    @Transactional
    public org.springframework.http.ResponseEntity<MessageDto.Result> retry(@PathVariable UUID id,
            @Valid @RequestBody MessageDto.RetryRequest input) {
        var result=retries.retry(id,input);
        return org.springframework.http.ResponseEntity.status(result.replayed()?200:202).body(result);
    }
}
