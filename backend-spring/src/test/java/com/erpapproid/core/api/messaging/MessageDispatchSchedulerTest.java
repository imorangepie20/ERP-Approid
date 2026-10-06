package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Scheduled;

class MessageDispatchSchedulerTest {
    @Test void polls_every_five_seconds_only_when_both_activation_flags_are_enabled() throws Exception {
        var worker=mock(MessageDispatchService.class);
        var properties=new EmailDeliveryProperties();
        var scheduler=new MessageDispatchScheduler(worker,properties);
        scheduler.poll();verifyNoInteractions(worker);
        properties.setEnabled(true);properties.setSchedulingEnabled(false);
        scheduler.poll();verifyNoInteractions(worker);
        properties.setSchedulingEnabled(true);scheduler.poll();verify(worker).poll();
        var schedule=MessageDispatchScheduler.class.getMethod("poll").getAnnotation(Scheduled.class);
        assertThat(schedule.fixedDelay()).isEqualTo(5000);
        assertThat(schedule.initialDelay()).isEqualTo(5000);
    }
}
