package com.erpapproid.core.api.messaging;

import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import com.erpapproid.core.domain.messaging.DeliveryOutcome;
import org.eclipse.angus.mail.smtp.SMTPSendFailedException;
import lombok.RequiredArgsConstructor;

/**
 * Authenticated STARTTLS submission with classified results.
 * Never logs recipients, bodies, credentials or raw SMTP replies.
 */
@RequiredArgsConstructor
public class SmtpEmailTransport implements EmailTransport {
    private static final Logger LOG = LoggerFactory.getLogger(SmtpEmailTransport.class);
    private final JavaMailSender sender;
    private final EmailDeliveryProperties properties;

    @Override
    public EmailSubmissionResult submit(EmailSubmission submission) {
        if (!properties.isEnabled()) {
            return new EmailSubmissionResult(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT,
                    EmailSubmissionResult.Failure.EMAIL_DISABLED);
        }
        final MimeMessage message;
        try {
            message = buildMessage(submission);
        } catch (MessagingException | RuntimeException ex) {
            return finish(submission, DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT,
                    EmailSubmissionResult.Failure.SMTP_PERMANENT_FAILURE);
        }
        try {
            sender.send(message);
            return finish(submission, DeliveryOutcome.ACCEPTED, null);
        } catch (MailAuthenticationException ex) {
            return finish(submission, DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT,
                    EmailSubmissionResult.Failure.AUTH_FAILED);
        } catch (MailSendException ex) {
            return finish(submission, classifySendFailure(ex));
        } catch (RuntimeException ex) {
            return finish(submission, DeliveryOutcome.UNKNOWN,
                    EmailSubmissionResult.Failure.TRANSPORT_EXCEPTION);
        }
    }

    private MimeMessage buildMessage(EmailSubmission submission) throws MessagingException {
        var message = sender.createMimeMessage();
        message.setFrom(new InternetAddress(properties.getFrom()));
        message.setRecipient(Message.RecipientType.TO, new InternetAddress(submission.recipient(), true));
        message.setSubject(submission.subject(), "UTF-8");
        message.setText(submission.body(), "UTF-8", "plain");
        message.setHeader("Message-ID", submission.smtpMessageId());
        return message;
    }

    private EmailSubmissionResult finish(EmailSubmission submission, DeliveryOutcome outcome,
            EmailSubmissionResult.Failure failure) {
        if (outcome == DeliveryOutcome.ACCEPTED) {
            return EmailSubmissionResult.accepted();
        }
        LOG.warn("Email submission failed; messageId={} failure={}", submission.messageId(), failure);
        return new EmailSubmissionResult(outcome, failure);
    }

    private EmailSubmissionResult finish(EmailSubmission submission, Classification classification) {
        return finish(submission, classification.outcome(), classification.failure());
    }

    private static Classification classifySendFailure(MailSendException ex) {
        Integer smtpCode = smtpReturnCode(ex);
        if (smtpCode != null) {
            if (smtpCode >= 400 && smtpCode < 500) {
                return new Classification(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_TRANSIENT,
                        EmailSubmissionResult.Failure.SMTP_TRANSIENT_FAILURE);
            }
            if (smtpCode >= 500 && smtpCode < 600) {
                return new Classification(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT,
                        EmailSubmissionResult.Failure.SMTP_PERMANENT_FAILURE);
            }
        }
        if (hasCause(ex, javax.net.ssl.SSLException.class)) {
            return new Classification(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT,
                    EmailSubmissionResult.Failure.TLS_FAILED);
        }
        if (hasCause(ex, java.net.ConnectException.class)
                || hasCause(ex, java.net.SocketTimeoutException.class)
                || hasCause(ex, java.net.UnknownHostException.class)) {
            return new Classification(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_TRANSIENT,
                    EmailSubmissionResult.Failure.CONNECTION_FAILED);
        }
        return new Classification(DeliveryOutcome.UNKNOWN,
                EmailSubmissionResult.Failure.SMTP_RESULT_UNKNOWN);
    }

    private static Integer smtpReturnCode(MailSendException ex) {
        for (var candidate : candidates(ex)) {
            if (candidate instanceof SMTPSendFailedException smtp) {
                return smtp.getReturnCode();
            }
        }
        return null;
    }

    private static boolean hasCause(MailSendException ex, Class<? extends Throwable> type) {
        for (var candidate : candidates(ex)) {
            for (var cause = candidate; cause != null; cause = cause.getCause()) {
                if (type.isInstance(cause)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static java.util.List<Throwable> candidates(MailSendException ex) {
        var all = new java.util.ArrayList<Throwable>();
        all.add(ex);
        all.addAll(ex.getFailedMessages().values());
        if (ex.getCause() != null) {
            all.add(ex.getCause());
        }
        return all;
    }

    private record Classification(DeliveryOutcome outcome, EmailSubmissionResult.Failure failure) {}
}
