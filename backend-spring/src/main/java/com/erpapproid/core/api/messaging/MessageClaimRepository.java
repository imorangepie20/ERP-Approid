package com.erpapproid.core.api.messaging;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class MessageClaimRepository {
    public static final int LEASE_SECONDS=120;
    private final JdbcTemplate jdbc;

    public record Claim(UUID messageId, UUID token, Instant until, long receivableId,
            long partnerId, long actorId, String traceId) {}

    @Transactional(propagation=Propagation.MANDATORY)
    public Optional<Claim> claimNext(Instant now) {
        UUID token=UUID.randomUUID();
        Instant until=now.plusSeconds(LEASE_SECONDS);
        var candidates=jdbc.query("""
                SELECT id,receivable_id,partner_id,actor_id,trace_id
                FROM outbound_messages WHERE state='QUEUED'
                ORDER BY requested_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
                """,(rs,row)->new Claim(rs.getObject("id",UUID.class),token,until,
                        rs.getLong("receivable_id"),rs.getLong("partner_id"),rs.getLong("actor_id"),rs.getString("trace_id")));
        if(candidates.isEmpty())return Optional.empty();
        var claim=candidates.getFirst();
        int updated=jdbc.update("""
                UPDATE outbound_messages SET state='CLAIMED',claim_token=?,claim_until=?,version=version+1
                WHERE id=? AND state='QUEUED'
                """,token,Timestamp.from(until),claim.messageId());
        if(updated!=1)throw new IllegalStateException("Claim state changed under lock");
        return Optional.of(claim);
    }
}
