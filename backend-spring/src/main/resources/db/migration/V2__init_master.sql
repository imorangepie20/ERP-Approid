-- 마스터: 품목, BOM, 공정, 거래처
-- db-schema.md 3.2

-- ============================================================
-- items
-- ============================================================
CREATE TABLE items (
    id               BIGSERIAL     PRIMARY KEY,
    item_no          VARCHAR(32)   NOT NULL UNIQUE,
    name             VARCHAR(128)  NOT NULL,
    spec             VARCHAR(128),
    category         VARCHAR(64),
    item_type        VARCHAR(16)   NOT NULL
                                    CHECK (item_type IN ('제품', '반제품', '자재')),
    unit             VARCHAR(16)   NOT NULL,
    price            BIGINT        NOT NULL DEFAULT 0,
    stock            NUMERIC(18,4) NOT NULL DEFAULT 0,
    safety_stock     NUMERIC(18,4) NOT NULL DEFAULT 0,
    lead_time_days   INTEGER       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by       BIGINT        REFERENCES users(id),
    updated_by       BIGINT        REFERENCES users(id),
    version          INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_items_item_type ON items (item_type);
CREATE INDEX idx_items_name ON items (name);

-- ============================================================
-- partners
-- ============================================================
CREATE TABLE partners (
    id              BIGSERIAL    PRIMARY KEY,
    partner_no      VARCHAR(32)  NOT NULL UNIQUE,
    name            VARCHAR(128) NOT NULL,
    contact         VARCHAR(64),
    payment_terms   INTEGER      NOT NULL DEFAULT 30,
    partner_type    VARCHAR(16)  NOT NULL
                                 CHECK (partner_type IN ('고객사', '발주처', '외주처')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      BIGINT       REFERENCES users(id),
    updated_by      BIGINT       REFERENCES users(id),
    version         INTEGER      NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_partners_updated_at
    BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_partners_partner_type ON partners (partner_type);
CREATE INDEX idx_partners_name ON partners (name);

-- ============================================================
-- boms
-- ============================================================
CREATE TABLE boms (
    id              BIGSERIAL     PRIMARY KEY,
    bom_no          VARCHAR(32)   NOT NULL UNIQUE,
    parent_id       BIGINT        NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    child_id        BIGINT        NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    qty             NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    loss_rate       NUMERIC(5,2)  NOT NULL DEFAULT 0,
    substitute_no   VARCHAR(32),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by      BIGINT        REFERENCES users(id),
    updated_by      BIGINT       REFERENCES users(id),
    version         INTEGER       NOT NULL DEFAULT 0,
    UNIQUE (parent_id, child_id)
);

CREATE TRIGGER trg_boms_updated_at
    BEFORE UPDATE ON boms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- routings
-- ============================================================
CREATE TABLE routings (
    id               BIGSERIAL     PRIMARY KEY,
    routing_no       VARCHAR(32)   NOT NULL UNIQUE,
    item_id          BIGINT        NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    seq              INTEGER       NOT NULL CHECK (seq > 0),
    process          VARCHAR(64)   NOT NULL,
    work_center      VARCHAR(32)   NOT NULL,
    std_time         NUMERIC(10,3) NOT NULL DEFAULT 0,
    is_subcontract   BOOLEAN       NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by       BIGINT        REFERENCES users(id),
    updated_by       BIGINT        REFERENCES users(id),
    version          INTEGER       NOT NULL DEFAULT 0,
    UNIQUE (item_id, seq)
);

CREATE TRIGGER trg_routings_updated_at
    BEFORE UPDATE ON routings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
