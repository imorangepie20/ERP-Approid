-- 자재·구매·재고: 발주, 입고, Lot, 입출고 이력
-- db-schema.md 3.5

-- ============================================================
-- purchase_orders
-- ============================================================
CREATE TABLE purchase_orders (
    id                  BIGSERIAL     PRIMARY KEY,
    purchase_order_no   VARCHAR(32)   NOT NULL UNIQUE,
    vendor_id           BIGINT        NOT NULL REFERENCES partners(id),
    item_id             BIGINT        NOT NULL REFERENCES items(id),
    qty                 NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    unit_price          BIGINT        NOT NULL,
    amount              BIGINT        NOT NULL,
    due_date            DATE          NOT NULL,
    status              VARCHAR(16)   NOT NULL DEFAULT '발주'
                                        CHECK (status IN ('발주', '부분입고', '입고완료', '취소')),
    received_qty        NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by          BIGINT        REFERENCES users(id),
    updated_by          BIGINT        REFERENCES users(id),
    version             INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_purchase_orders_status ON purchase_orders (status, created_at DESC);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders (vendor_id);

-- ============================================================
-- receivings
-- ============================================================
CREATE TABLE receivings (
    id               BIGSERIAL     PRIMARY KEY,
    receiving_no     VARCHAR(32)   NOT NULL UNIQUE,
    purchase_order_id BIGINT       NOT NULL REFERENCES purchase_orders(id),
    vendor_id        BIGINT        NOT NULL REFERENCES partners(id),
    item_id          BIGINT        NOT NULL REFERENCES items(id),
    order_qty        NUMERIC(18,4) NOT NULL,
    received_qty     NUMERIC(18,4) NOT NULL CHECK (received_qty >= 0),
    defect_qty       NUMERIC(18,4) NOT NULL DEFAULT 0,
    received_date    DATE          NOT NULL,
    status           VARCHAR(16)   NOT NULL
                                     CHECK (status IN ('검수중', '합격', '부분합격', '반품')),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by       BIGINT        REFERENCES users(id),
    updated_by       BIGINT        REFERENCES users(id),
    version          INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_receivings_updated_at
    BEFORE UPDATE ON receivings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_receivings_purchase_order ON receivings (purchase_order_id);
CREATE INDEX idx_receivings_status ON receivings (status);

-- ============================================================
-- lots
-- ============================================================
CREATE TABLE lots (
    id            BIGSERIAL     PRIMARY KEY,
    lot_no        VARCHAR(32)   NOT NULL UNIQUE,
    item_id       BIGINT        NOT NULL REFERENCES items(id),
    warehouse     VARCHAR(32)   NOT NULL,
    qty           NUMERIC(18,4) NOT NULL DEFAULT 0,
    produced_at   DATE          NOT NULL,
    expiry        DATE,
    status        VARCHAR(16)   NOT NULL DEFAULT '정상'
                                CHECK (status IN ('정상', '보류', '유통기한임박', '폐기')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by    BIGINT        REFERENCES users(id),
    updated_by    BIGINT        REFERENCES users(id),
    version       INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_lots_updated_at
    BEFORE UPDATE ON lots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_lots_item_status ON lots (item_id, status);
CREATE INDEX idx_lots_expiry ON lots (expiry) WHERE expiry < '9999-12-31';

-- ============================================================
-- inventory_transactions
-- ============================================================
CREATE TABLE inventory_transactions (
    id          BIGSERIAL     PRIMARY KEY,
    txn_no      VARCHAR(32)   NOT NULL UNIQUE,
    item_id     BIGINT        NOT NULL REFERENCES items(id),
    lot_id      BIGINT        REFERENCES lots(id),
    warehouse   VARCHAR(32)   NOT NULL,
    txn_type    VARCHAR(16)   NOT NULL
                               CHECK (txn_type IN ('입고', '생산입고', '출고', '출하', '이동', '실사')),
    qty         NUMERIC(18,4) NOT NULL,
    ref_type    VARCHAR(32),
    ref_no      VARCHAR(32),
    txn_date    DATE          NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by  BIGINT        REFERENCES users(id)
);

CREATE INDEX idx_inventory_txns_item_date ON inventory_transactions (item_id, txn_date DESC);
CREATE INDEX idx_inventory_txns_ref ON inventory_transactions (ref_type, ref_no);
CREATE INDEX idx_inventory_txns_lot ON inventory_transactions (lot_id);
