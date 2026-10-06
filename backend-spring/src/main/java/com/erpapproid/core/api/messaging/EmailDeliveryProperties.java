package com.erpapproid.core.api.messaging;

import org.springframework.boot.context.properties.ConfigurationProperties;
import lombok.Getter;
import lombok.Setter;

@ConfigurationProperties(prefix="erp.messaging.email")
@Getter
@Setter
public class EmailDeliveryProperties {
    private boolean enabled;
    private boolean schedulingEnabled = true;
    private String host;
    private int port = 587;
    private String username;
    private String password;
    private String from;
    private String envelopeFrom;
    private int connectionTimeoutMillis = 5000;
    private int readTimeoutMillis = 3000;
    private int writeTimeoutMillis = 5000;
    private String trustStorePath;
    private String trustStorePassword;
}
