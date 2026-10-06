package com.erpapproid.core.api.messaging;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import lombok.Getter;
import lombok.Setter;

@Component
@ConfigurationProperties(prefix="erp.messaging.email")
@Getter
@Setter
public class EmailDeliveryProperties {
    private boolean enabled;
    private boolean schedulingEnabled = true;
}
