package com.erpapproid.core.api.messaging;

import java.io.FileInputStream;
import java.io.InputStream;
import java.security.KeyStore;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import lombok.RequiredArgsConstructor;

/** SMTP beans exist only when delivery is enabled, with complete settings or no startup. */
@Configuration
@RequiredArgsConstructor
@EnableConfigurationProperties(EmailDeliveryProperties.class)
@ConditionalOnProperty(prefix = "erp.messaging.email", name = "enabled", havingValue = "true")
public class EmailDeliveryConfiguration {
    private final EmailDeliveryProperties properties;

    @Bean
    public JavaMailSender emailSender() {
        requireDeliverySettings(properties);
        var sender = new JavaMailSenderImpl();
        sender.setHost(properties.getHost());
        sender.setPort(properties.getPort());
        sender.setUsername(properties.getUsername());
        sender.setPassword(properties.getPassword());
        var mail = sender.getJavaMailProperties();
        mail.put("mail.transport.protocol", "smtp");
        mail.put("mail.smtp.auth", "true");
        mail.put("mail.smtp.starttls.required", "true");
        mail.put("mail.smtp.ssl.checkserveridentity", "true");
        mail.put("mail.smtp.from", properties.getEnvelopeFrom());
        mail.put("mail.smtp.connectiontimeout", String.valueOf(properties.getConnectionTimeoutMillis()));
        mail.put("mail.smtp.timeout", String.valueOf(properties.getReadTimeoutMillis()));
        mail.put("mail.smtp.writetimeout", String.valueOf(properties.getWriteTimeoutMillis()));
        mail.put("mail.debug", "false");
        if (properties.getTrustStorePath() != null) {
            mail.put("mail.smtp.ssl.socketFactory", socketFactory(properties));
        }
        return sender;
    }

    @Bean
    public EmailTransport emailTransport(JavaMailSender emailSender) {
        return new SmtpEmailTransport(emailSender, properties);
    }

    static void requireDeliverySettings(EmailDeliveryProperties props) {
        if (isBlank(props.getHost()) || props.getPort() < 1 || props.getPort() > 65535
                || isBlank(props.getUsername()) || isBlank(props.getPassword())
                || isBlank(props.getFrom()) || isBlank(props.getEnvelopeFrom())
                || props.getConnectionTimeoutMillis() <= 0 || props.getReadTimeoutMillis() <= 0
                || props.getWriteTimeoutMillis() <= 0) {
            throw new IllegalStateException("Email delivery is enabled but SMTP settings are incomplete");
        }
        if (props.getTrustStorePath() != null && !new java.io.File(props.getTrustStorePath()).canRead()) {
            throw new IllegalStateException("Email delivery truststore is not readable");
        }
    }

    private static javax.net.ssl.SSLSocketFactory socketFactory(EmailDeliveryProperties props) {
        try {
            var store = KeyStore.getInstance(KeyStore.getDefaultType());
            try (InputStream in = new FileInputStream(props.getTrustStorePath())) {
                store.load(in, props.getTrustStorePassword() == null
                        ? null : props.getTrustStorePassword().toCharArray());
            }
            var factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            factory.init(store);
            var context = SSLContext.getInstance("TLS");
            context.init(null, factory.getTrustManagers(), null);
            return context.getSocketFactory();
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Email delivery truststore cannot be loaded", ex);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
