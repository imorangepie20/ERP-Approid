-- Historical shipments remain unlinked: never infer past Lot consumption or revenue.
ALTER TABLE shipments ADD COLUMN lot_id BIGINT REFERENCES lots(id);
ALTER TABLE shipments ADD COLUMN inventory_txn_id BIGINT UNIQUE REFERENCES inventory_transactions(id);
ALTER TABLE shipments ADD COLUMN receivable_id BIGINT UNIQUE REFERENCES receivables(id);
ALTER TABLE shipments ADD COLUMN tracking_no VARCHAR(64);
ALTER TABLE shipments ADD COLUMN departed_date DATE;
ALTER TABLE shipments ADD COLUMN confirmed_date DATE;
ALTER TABLE shipments DROP CONSTRAINT shipments_status_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
    CHECK (status IN ('지시', '배차', '출발', '출하완료', '매출반영', '취소'));
CREATE INDEX idx_shipments_lot ON shipments(lot_id);
