-- New email state only. Do not infer addresses/permission or rewrite financial history.
CREATE TABLE partner_message_contacts (
    id BIGSERIAL PRIMARY KEY,
    partner_id BIGINT NOT NULL REFERENCES partners(id),
    purpose VARCHAR(32) NOT NULL DEFAULT 'RECEIVABLE_REMINDER',
    channel VARCHAR(16) NOT NULL DEFAULT 'EMAIL',
    email VARCHAR(254) NOT NULL,
    permission VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    confirmation_note VARCHAR(256),
    confirmed_by BIGINT REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT uq_message_contact UNIQUE (partner_id, purpose, channel),
    CONSTRAINT ck_message_contact_purpose CHECK (purpose = 'RECEIVABLE_REMINDER'),
    CONSTRAINT ck_message_contact_channel CHECK (channel = 'EMAIL'),
    CONSTRAINT ck_message_contact_email CHECK (
        email ~ '^[^@]+@[^@]+$' AND email !~ '[[:space:],;<>]'
        AND octet_length(email) = length(email)),
    CONSTRAINT ck_message_contact_permission CHECK (permission IN ('PENDING', 'ALLOWED', 'BLOCKED')),
    CONSTRAINT ck_message_contact_confirmation CHECK (permission <> 'ALLOWED' OR (
        confirmation_note IS NOT NULL AND length(btrim(confirmation_note)) > 0
        AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE TRIGGER trg_message_contacts_updated_at BEFORE UPDATE ON partner_message_contacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE outbound_messages (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL UNIQUE,
    receivable_id BIGINT NOT NULL REFERENCES receivables(id),
    partner_id BIGINT NOT NULL REFERENCES partners(id),
    contact_id BIGINT NOT NULL REFERENCES partner_message_contacts(id),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    trace_id VARCHAR(128) NOT NULL CHECK (length(btrim(trace_id)) > 0),
    input_hash VARCHAR(64) NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
    snapshot_hash VARCHAR(64) NOT NULL CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
    template_version VARCHAR(64) NOT NULL CHECK (length(btrim(template_version)) > 0),
    recipient VARCHAR(254) NOT NULL CHECK (
        recipient ~ '^[^@]+@[^@]+$' AND recipient !~ '[[:space:],;<>]'
        AND octet_length(recipient) = length(recipient)),
    subject VARCHAR(256) NOT NULL CHECK (length(btrim(subject)) > 0 AND subject !~ E'[\r\n]'),
    body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
    note VARCHAR(1000) NOT NULL DEFAULT '',
    receivable_no VARCHAR(32) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    receivable_status VARCHAR(16) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    collected_amount BIGINT NOT NULL CHECK (collected_amount >= 0),
    remaining_amount BIGINT NOT NULL CHECK (remaining_amount > 0 AND remaining_amount = amount - collected_amount),
    due_date DATE NOT NULL,
    reference_date DATE NOT NULL,
    contact_version INTEGER NOT NULL CHECK (contact_version >= 0),
    contact_permission VARCHAR(16) NOT NULL CHECK (contact_permission = 'ALLOWED'),
    state VARCHAR(32) NOT NULL DEFAULT 'QUEUED' CHECK (state IN (
        'QUEUED', 'CLAIMED', 'DISPATCHING', 'RETRY_WAIT', 'SMTP_ACCEPTED', 'FAILED', 'STALE', 'UNKNOWN')),
    requested_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > requested_at),
    next_attempt_at TIMESTAMPTZ,
    claim_token UUID,
    claim_until TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
    smtp_message_id VARCHAR(255) NOT NULL CHECK (length(btrim(smtp_message_id)) > 0 AND smtp_message_id !~ E'[\r\n]'),
    accepted_at TIMESTAMPTZ,
    accepted_on DATE,
    error_code VARCHAR(64) CHECK (error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT ck_message_request_id CHECK (id = request_id),
    CONSTRAINT ck_message_acceptance CHECK (
        (state = 'SMTP_ACCEPTED' AND accepted_at IS NOT NULL AND accepted_on IS NOT NULL
            AND accepted_on = (accepted_at AT TIME ZONE 'Asia/Seoul')::date)
        OR (state <> 'SMTP_ACCEPTED' AND accepted_at IS NULL AND accepted_on IS NULL))
);

-- UNKNOWN deliberately keeps the active slot: an uncertain SMTP result is not safe to retry.
CREATE UNIQUE INDEX uq_message_active_receivable ON outbound_messages(receivable_id)
    WHERE state IN ('QUEUED', 'CLAIMED', 'DISPATCHING', 'RETRY_WAIT', 'UNKNOWN');
CREATE UNIQUE INDEX uq_message_daily_acceptance ON outbound_messages(receivable_id, accepted_on)
    WHERE state = 'SMTP_ACCEPTED';
CREATE INDEX idx_message_poll ON outbound_messages(state, next_attempt_at, requested_at);
CREATE INDEX idx_message_history ON outbound_messages(receivable_id, requested_at DESC, id);
CREATE INDEX idx_message_contact ON outbound_messages(contact_id);
CREATE INDEX idx_message_partner ON outbound_messages(partner_id);
CREATE INDEX idx_message_actor ON outbound_messages(actor_id);

CREATE TABLE message_delivery_attempts (
    id BIGSERIAL PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES outbound_messages(id),
    attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
    claim_token UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    outcome VARCHAR(64) CHECK (outcome IN ('ACCEPTED', 'DEFINITELY_NOT_ACCEPTED_TRANSIENT',
        'DEFINITELY_NOT_ACCEPTED_PERMANENT', 'UNKNOWN')),
    error_code VARCHAR(64) CHECK (error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
    smtp_message_id VARCHAR(255) NOT NULL CHECK (length(btrim(smtp_message_id)) > 0 AND smtp_message_id !~ E'[\r\n]'),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    trace_id VARCHAR(128) NOT NULL CHECK (length(btrim(trace_id)) > 0),
    CONSTRAINT uq_message_attempt UNIQUE (message_id, attempt_number),
    CONSTRAINT ck_message_attempt_finish CHECK (
        (finished_at IS NULL AND outcome IS NULL)
        OR (finished_at IS NOT NULL AND finished_at >= started_at AND outcome IS NOT NULL))
);

CREATE TABLE message_retry_requests (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES outbound_messages(id),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    trace_id VARCHAR(128) NOT NULL CHECK (length(btrim(trace_id)) > 0),
    input_hash VARCHAR(64) NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
    requested_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_message_retry_history ON message_retry_requests(message_id, requested_at, id);
