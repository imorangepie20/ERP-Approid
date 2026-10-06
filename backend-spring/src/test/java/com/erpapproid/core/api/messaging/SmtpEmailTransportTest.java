package com.erpapproid.core.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.UUID;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import com.erpapproid.core.domain.messaging.DeliveryOutcome;
import org.eclipse.angus.mail.smtp.SMTPSendFailedException;

/** EMAIL-05 RED: SmtpEmailTransport does not exist yet. */
class SmtpEmailTransportTest {

    private EmailDeliveryProperties enabledProperties() {
        var properties = new EmailDeliveryProperties();
        properties.setEnabled(true);
        properties.setHost("mail.approid.team");
        properties.setPort(587);
        properties.setUsername("reminder");
        properties.setPassword("secret");
        properties.setFrom("reminder@approid.team");
        properties.setEnvelopeFrom("reminder@approid.team");
        return properties;
    }

    private EmailSubmission submission() {
        UUID id = UUID.randomUUID();
        return new EmailSubmission(id, "customer@example.com", "Subject", "Body", "<" + id + "@erp.approid.team>");
    }

    private void sendFails(JavaMailSender sender, RuntimeException failure) {
        when(sender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        Mockito.doThrow(failure).when(sender).send(any(MimeMessage.class));
    }

    @Test void sends_single_recipient_with_fixed_message_id() throws Exception {
        var sender = mock(JavaMailSender.class);
        when(sender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        var transport = new SmtpEmailTransport(sender, enabledProperties());

        var result = transport.submit(submission());

        assertThat(result.outcome()).isEqualTo(DeliveryOutcome.ACCEPTED);
        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        var sent = captor.getValue();
        assertThat(sent.getAllRecipients()).hasSize(1);
        assertThat(sent.getAllRecipients()[0].toString()).isEqualTo("customer@example.com");
        assertThat(sent.getHeader("Message-ID", null)).contains("@erp.approid.team");
    }

    @Test void classifies_explicit_4xx_as_transient() {
        var sender = mock(JavaMailSender.class);
        sendFails(sender, new MailSendException(Map.of("recipient",
                new SMTPSendFailedException("DATA", 421, "Service unavailable", null, null, null, null))));
        var transport = new SmtpEmailTransport(sender, enabledProperties());

        var result = transport.submit(submission());

        assertThat(result.outcome()).isEqualTo(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_TRANSIENT);
        assertThat(result.failure()).isEqualTo(EmailSubmissionResult.Failure.SMTP_TRANSIENT_FAILURE);
    }

    @Test void classifies_5xx_as_permanent() {
        var sender = mock(JavaMailSender.class);
        sendFails(sender, new MailSendException(Map.of("recipient",
                new SMTPSendFailedException("DATA", 550, "Rejected", null, null, null, null))));
        var transport = new SmtpEmailTransport(sender, enabledProperties());

        var result = transport.submit(submission());

        assertThat(result.outcome()).isEqualTo(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT);
        assertThat(result.failure()).isEqualTo(EmailSubmissionResult.Failure.SMTP_PERMANENT_FAILURE);
    }

    @Test void classifies_auth_failure_as_permanent_without_retry() {
        var sender = mock(JavaMailSender.class);
        sendFails(sender, new MailAuthenticationException("bad credentials"));
        var transport = new SmtpEmailTransport(sender, enabledProperties());

        var result = transport.submit(submission());

        assertThat(result.outcome()).isEqualTo(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT);
        assertThat(result.failure()).isEqualTo(EmailSubmissionResult.Failure.AUTH_FAILED);
    }

    @Test void classifies_unclear_failure_as_unknown() {
        var sender = mock(JavaMailSender.class);
        sendFails(sender, new MailSendException("unclear"));
        var transport = new SmtpEmailTransport(sender, enabledProperties());

        var result = transport.submit(submission());

        assertThat(result.outcome()).isEqualTo(DeliveryOutcome.UNKNOWN);
    }

    @Test void refuses_to_send_when_disabled() {
        var sender = mock(JavaMailSender.class);
        var properties = new EmailDeliveryProperties();
        properties.setEnabled(false);
        var transport = new SmtpEmailTransport(sender, properties);

        var result = transport.submit(submission());

        assertThat(result.outcome()).isEqualTo(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT);
        assertThat(result.failure()).isEqualTo(EmailSubmissionResult.Failure.EMAIL_DISABLED);
        verifyNoInteractions(sender);
    }
}
