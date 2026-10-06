package com.erpapproid.core.api.messaging;

/** Implementations must return classified results, never raw SMTP errors or credentials. */
public interface EmailTransport {
    EmailSubmissionResult submit(EmailSubmission submission);
}
