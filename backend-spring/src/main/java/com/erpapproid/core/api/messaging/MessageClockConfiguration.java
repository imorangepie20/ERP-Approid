package com.erpapproid.core.api.messaging;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MessageClockConfiguration {
    @Bean("messageClock")
    public Clock messageClock() { return Clock.systemUTC(); }
}
