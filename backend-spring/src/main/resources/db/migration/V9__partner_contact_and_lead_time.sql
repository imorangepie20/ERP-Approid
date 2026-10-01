ALTER TABLE partners
    ADD COLUMN contact_name VARCHAR(64),
    ADD COLUMN lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0);
