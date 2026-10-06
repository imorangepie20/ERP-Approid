package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/** EMAIL-05 RED: EmailDeliveryConfiguration does not exist yet. */
class EmailDeliveryConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EmailDeliveryConfiguration.class));

    @Test void disabled_by_default_and_exposes_no_smtp_transport() {
        assertThat(new EmailDeliveryProperties().isEnabled()).isFalse();
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(EmailTransport.class);
        });
    }

    @Test void enabled_without_smtp_settings_fails_closed() {
        runner.withPropertyValues("erp.messaging.email.enabled=true")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test void smtp_sender_uses_authenticated_starttls_timeouts_without_debug() {
        runner.withPropertyValues(
                "erp.messaging.email.enabled=true",
                "erp.messaging.email.host=mail.approid.team",
                "erp.messaging.email.port=587",
                "erp.messaging.email.username=reminder",
                "erp.messaging.email.password=secret",
                "erp.messaging.email.from=reminder@approid.team",
                "erp.messaging.email.envelope-from=reminder@approid.team")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(EmailTransport.class);
                    var sender = context.getBean(org.springframework.mail.javamail.JavaMailSenderImpl.class);
                    assertThat(sender.getHost()).isEqualTo("mail.approid.team");
                    assertThat(sender.getPort()).isEqualTo(587);
                    assertThat(sender.getUsername()).isEqualTo("reminder");
                    assertThat(sender.getJavaMailProperties().getProperty("mail.smtp.auth")).isEqualTo("true");
                    assertThat(sender.getJavaMailProperties().getProperty("mail.smtp.starttls.required")).isEqualTo("true");
                    assertThat(sender.getJavaMailProperties().getProperty("mail.debug")).isEqualTo("false");
                    assertThat(sender.getJavaMailProperties().getProperty("mail.smtp.connectiontimeout")).isEqualTo("5000");
                    assertThat(sender.getJavaMailProperties().getProperty("mail.smtp.timeout")).isEqualTo("3000");
                    assertThat(sender.getJavaMailProperties().getProperty("mail.smtp.writetimeout")).isEqualTo("5000");
                });
    }
}
