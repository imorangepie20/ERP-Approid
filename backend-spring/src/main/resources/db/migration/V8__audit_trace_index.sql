CREATE INDEX idx_audit_logs_trace_id
    ON audit_logs (trace_id)
    WHERE trace_id IS NOT NULL;
