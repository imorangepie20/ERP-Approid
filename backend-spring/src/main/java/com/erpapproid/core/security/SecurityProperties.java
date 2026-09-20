package com.erpapproid.core.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.security")
public class SecurityProperties {

    private Jwt jwt = new Jwt();
    private String internalKey = "";

    @Getter
    @Setter
    public static class Jwt {
        private String secret = "";
        private int expirationMinutes = 60;
    }
}
