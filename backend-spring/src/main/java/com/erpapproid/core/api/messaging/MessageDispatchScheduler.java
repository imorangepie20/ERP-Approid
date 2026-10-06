package com.erpapproid.core.api.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;

@Component
@EnableScheduling
@RequiredArgsConstructor
@ConditionalOnProperty(prefix="erp.messaging.email",name="enabled",havingValue="true")
public class MessageDispatchScheduler {
    public static final long POLL_DELAY_MILLIS=5000;
    private static final Logger LOG=LoggerFactory.getLogger(MessageDispatchScheduler.class);
    private final MessageDispatchService worker;
    private final EmailDeliveryProperties properties;

    @Scheduled(fixedDelay=POLL_DELAY_MILLIS,initialDelay=POLL_DELAY_MILLIS)
    public void poll() {
        if(!properties.isEnabled() || !properties.isSchedulingEnabled())return;
        try {
            worker.poll();
        } catch(RuntimeException ex) {
            // Do not log exception messages, SMTP replies, recipient/body or credentials.
            LOG.error("Email dispatch poll stopped; outcome=PROCESSING_FAILURE");
        }
    }
}
