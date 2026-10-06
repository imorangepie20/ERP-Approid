package com.erpapproid.core.api.messaging;

import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.erpapproid.core.api.sales.ReceivableReminderService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/core/messages")
@RequiredArgsConstructor
public class MessageController {
    private final ReceivableReminderService reminders;
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTING','SALES')")
    public MessageDto.Response detail(@PathVariable UUID id) { return reminders.detail(id); }
}
