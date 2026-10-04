-- 과거 이력은 재고 반영 여부와 Lot 연결을 추정하지 않는다.
ALTER TABLE receivings ADD COLUMN stock_applied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE receivings ADD COLUMN lot_id BIGINT UNIQUE REFERENCES lots(id);
ALTER TABLE receivings ADD COLUMN inventory_txn_id BIGINT UNIQUE REFERENCES inventory_transactions(id);
ALTER TABLE receivings ADD COLUMN reversal_txn_id BIGINT UNIQUE REFERENCES inventory_transactions(id);
ALTER TABLE receivings ADD COLUMN cancelled_date DATE;
ALTER TABLE receivings DROP CONSTRAINT receivings_status_check;
ALTER TABLE receivings ADD CONSTRAINT receivings_status_check
    CHECK (status IN ('검수중', '합격', '부분합격', '불합격', '반품', '취소'));
ALTER TABLE receivings ADD CONSTRAINT ck_receivings_quantities
    CHECK (received_qty > 0 AND defect_qty >= 0 AND defect_qty <= received_qty) NOT VALID;
