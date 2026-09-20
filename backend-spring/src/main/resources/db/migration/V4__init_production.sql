-- 생산: 생산계획, 작업오더
-- db-schema.md 3.4

-- ============================================================
-- production_plans (MPS)
-- ============================================================
CREATE TABLE production_plans (
    id           BIGSERIAL     PRIMARY KEY,
    plan_no      VARCHAR(32)   NOT NULL UNIQUE,
    item_id      BIGINT        NOT NULL REFERENCES items(id),
    plan_month   VARCHAR(7)    NOT NULL,
    plan_qty     NUMERIC(18,4) NOT NULL,
    order_qty    NUMERIC(18,4) NOT NULL DEFAULT 0,
    stock_qty    NUMERIC(18,4) NOT NULL DEFAULT 0,
    gap_qty      NUMERIC(18,4) NOT NULL DEFAULT 0,
    status       VARCHAR(16)   NOT NULL DEFAULT '계획'
                                 CHECK (status IN ('계획', '확정', '종결')),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by   BIGINT        REFERENCES users(id),
    updated_by   BIGINT        REFERENCES users(id),
    version      INTEGER       NOT NULL DEFAULT 0,
    UNIQUE (item_id, plan_month)
);

CREATE TRIGGER trg_production_plans_updated_at
    BEFORE UPDATE ON production_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_production_plans_month ON production_plans (plan_month);
CREATE INDEX idx_production_plans_status ON production_plans (status);

-- ============================================================
-- work_orders
-- ============================================================
CREATE TABLE work_orders (
    id               BIGSERIAL     PRIMARY KEY,
    work_order_no    VARCHAR(32)   NOT NULL UNIQUE,
    sales_order_id   BIGINT        REFERENCES sales_orders(id),
    item_id          BIGINT        NOT NULL REFERENCES items(id),
    qty              NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    good_qty         NUMERIC(18,4) NOT NULL DEFAULT 0,
    defect_qty       NUMERIC(18,4) NOT NULL DEFAULT 0,
    progress         NUMERIC(5,2)  NOT NULL DEFAULT 0,
    start_date       DATE          NOT NULL,
    due_date         DATE          NOT NULL,
    status           VARCHAR(16)   NOT NULL DEFAULT '지시'
                                      CHECK (status IN ('지시', '진행중', '완료', '마감', '취소')),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by       BIGINT        REFERENCES users(id),
    updated_by       BIGINT        REFERENCES users(id),
    version          INTEGER       NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_work_orders_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_work_orders_status_due ON work_orders (status, due_date);
CREATE INDEX idx_work_orders_item ON work_orders (item_id);
CREATE INDEX idx_work_orders_sales_order ON work_orders (sales_order_id);
