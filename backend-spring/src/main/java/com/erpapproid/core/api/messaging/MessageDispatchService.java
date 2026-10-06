package com.erpapproid.core.api.messaging;

import java.util.Optional;
import java.util.Objects;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.erpapproid.core.domain.messaging.DeliveryOutcome;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MessageDispatchService {
    public static final int POLL_LIMIT=10;
    private final MessageDispatchTransactions transactions;
    private final EmailDeliveryProperties properties;
    private final ObjectProvider<EmailTransport> transports;

    public int poll() {
        requireNoTransaction();
        transactions.recoverStale();
        int handled=0;
        while(handled<POLL_LIMIT && dispatchOne())handled++;
        return handled;
    }

    public boolean dispatchOne() {
        requireNoTransaction();
        var transport=transports.getIfAvailable();
        if(!properties.isEnabled() || transport==null)return false;
        var candidate=claimOne();
        if(candidate.isEmpty())return false;
        var claim=candidate.get();
        var submission=preflight(claim);
        if(submission.isEmpty())return true;
        EmailSubmissionResult result;
        if(!properties.isEnabled()) {
            result=new EmailSubmissionResult(DeliveryOutcome.DEFINITELY_NOT_ACCEPTED_PERMANENT,EmailSubmissionResult.Failure.EMAIL_DISABLED);
        } else {
            // All DB transactions and business locks have ended. Never print transport exceptions.
            try {
                result=Objects.requireNonNull(transport.submit(submission.get()));
            } catch(RuntimeException ex) {
                result=new EmailSubmissionResult(DeliveryOutcome.UNKNOWN,EmailSubmissionResult.Failure.TRANSPORT_EXCEPTION);
            }
        }
        // A persistence/audit failure leaves DISPATCHING, not a falsely rolled-back send.
        // It cannot be claimed again; recovery to UNKNOWN is implemented in EMAIL-06.
        finalizeSubmission(claim,result);
        return true;
    }

    public Optional<MessageClaimRepository.Claim> claimOne() {
        requireNoTransaction();return transactions.claimOne();
    }
    public Optional<EmailSubmission> preflight(MessageClaimRepository.Claim claim) {
        requireNoTransaction();return transactions.preflight(claim);
    }
    public boolean finalizeSubmission(MessageClaimRepository.Claim claim,EmailSubmissionResult result) {
        requireNoTransaction();return transactions.finalizeSubmission(claim,result);
    }
    private static void requireNoTransaction() {
        if(TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Dispatch must start outside a database transaction");
        }
    }
}
