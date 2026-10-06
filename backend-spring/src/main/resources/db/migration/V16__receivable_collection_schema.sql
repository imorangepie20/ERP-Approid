-- Forward-only expansion. No original document amounts or dates are changed.
ALTER TABLE receivables ADD COLUMN collected_amount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN opening_collected_amount BIGINT NOT NULL DEFAULT 0;

CREATE TABLE receivable_collections (
    id BIGSERIAL PRIMARY KEY,
    receivable_id BIGINT NOT NULL REFERENCES receivables(id),
    request_id UUID NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    collected_on DATE NOT NULL,
    remaining_amount BIGINT NOT NULL CHECK (remaining_amount >= 0),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    trace_id VARCHAR(128) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(receivable_id, request_id)
);
-- New empty table; the index does not block an existing history workload.
CREATE INDEX idx_receivable_collections_history ON receivable_collections(receivable_id, id DESC);
