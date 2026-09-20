-- 영업·수주: 견적, 수주, 출하, 미수금
-- db-schema.md 3.3

-- ============================================================
-- quotations
-- ============================================================
CREATE TABLE quotations (
    id              BIGSERIAL     PRIMARY KEY,
    quotation_no    VARCHAR(32)   NOT NULL UNIQUE,
    customer_id     BIGINT        NOT NULL REFERENCES partners(id),
    item_id         BIGINT        NOT NULL REFERENCES items(id),
    qty             NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    unit_price      BIGINT        NOT NULL,
    amount          BIGINT        NOT NULL,
    due_date        DATE          NOT NULL,
    valid_until     DATE          NOT NULL,
    status          VARCHAR(16)   NOT NULL DEFAULT '작성중'
                                    CHECK (status IN ('작성중', '발송완료', '수주완료', '만료')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by      BIGINT        REFERENCES users(id),
    updated_by      BIGINT        REFERENCES users(id),
    version         INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_quotations_updated_at
    BEFORE UPDATE ON quotations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_quotations_status ON quotations (status);
CREATE INDEX idx_quotations_customer ON quotations (customer_id);

-- ============================================================
-- sales_orders
-- ============================================================
CREATE TABLE sales_orders (
    id                BIGSERIAL     PRIMARY KEY,
    sales_order_no    VARCHAR(32)   NOT NULL UNIQUE,
    quotation_id      BIGINT        REFERENCES quotations(id),
    customer_id       BIGINT        NOT NULL REFERENCES partners(id),
    item_id           BIGINT        NOT NULL REFERENCES items(id),
    qty               NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    unit_price        BIGINT        NOT NULL,
    amount            BIGINT        NOT NULL,
    due_date          DATE          NOT NULL,
    status            VARCHAR(16)   NOT NULL DEFAULT '대기'
                                      CHECK (status IN ('대기', '확정', '생산중', '출하완료', '취소')),
    ordered_at        DATE          NOT NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by        BIGINT        REFERENCES users(id),
    updated_by        BIGINT        REFERENCES users(id),
    version           INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_sales_orders_updated_at
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_sales_orders_status_ordered ON sales_orders (status, ordered_at DESC);
CREATE INDEX idx_sales_orders_customer ON sales_orders (customer_id);
CREATE INDEX idx_sales_orders_quotation ON sales_orders (quotation_id);

-- ============================================================
-- shipments
-- ============================================================
CREATE TABLE shipments (
    id              BIGSERIAL     PRIMARY KEY,
    shipment_no     VARCHAR(32)   NOT NULL UNIQUE,
    sales_order_id  BIGINT        NOT NULL REFERENCES sales_orders(id),
    customer_id     BIGINT        NOT NULL REFERENCES partners(id),
    item_id         BIGINT        NOT NULL REFERENCES items(id),
    qty             NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    amount          BIGINT        NOT NULL,
    delivery_date   DATE          NOT NULL,
    vehicle         VARCHAR(64),
    status          VARCHAR(16)   NOT NULL DEFAULT '지시'
                                    CHECK (status IN ('지시', '배차', '출하완료', '매출반영')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by      BIGINT        REFERENCES users(id),
    updated_by      BIGINT        REFERENCES users(id),
    version         INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shipments_status ON shipments (status);
CREATE INDEX idx_shipments_customer ON shipments (customer_id);
CREATE INDEX idx_shipments_sales_order ON shipments (sales_order_id);

-- ============================================================
-- receivables
-- ============================================================
CREATE TABLE receivables (
    id               BIGSERIAL   PRIMARY KEY,
    receivable_no    VARCHAR(32) NOT NULL UNIQUE,
    customer_id      BIGINT      NOT NULL REFERENCES partners(id),
    sales_order_id   BIGINT      REFERENCES sales_orders(id),
    amount           BIGINT      NOT NULL,
    due_date         DATE        NOT NULL,
    overdue_days     INTEGER     NOT NULL DEFAULT 0,
    status           VARCHAR(16) NOT NULL DEFAULT '미수'
                                 CHECK (status IN ('미수', '수납완료', '연체')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       BIGINT      REFERENCES users(id),
    updated_by       BIGINT      REFERENCES users(id),
    version          INTEGER     NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_receivables_updated_at
    BEFORE UPDATE ON receivables
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_receivables_status_due ON receivables (status, due_date);
CREATE INDEX idx_receivables_customer ON receivables (customer_id);
