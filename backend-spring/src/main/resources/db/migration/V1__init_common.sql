-- 공통: 인증·권한·감사 + updated_at 트리거 함수
-- db-schema.md 3.1, 7

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- roles
-- ============================================================
CREATE TABLE roles (
    id    BIGSERIAL    PRIMARY KEY,
    code  VARCHAR(32)  NOT NULL UNIQUE,
    name  VARCHAR(64)  NOT NULL
);

INSERT INTO roles (code, name) VALUES
    ('ADMIN', '대표이사'),
    ('SALES', '영업 담당자'),
    ('PRODUCTION', '생산관리자'),
    ('MATERIAL', '자재/구매 담당자'),
    ('QUALITY', '품질 담당자'),
    ('ACCOUNTING', '회계 담당자');

-- ============================================================
-- users
-- ============================================================
CREATE TABLE users (
    id             BIGSERIAL    PRIMARY KEY,
    username       VARCHAR(64)  NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    name           VARCHAR(64)  NOT NULL,
    email          VARCHAR(128),
    employee_no    VARCHAR(32),
    status         VARCHAR(16)  NOT NULL DEFAULT '활성'
                               CHECK (status IN ('활성', '잠김', '퇴사')),
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by     BIGINT       REFERENCES users(id),
    updated_by     BIGINT       REFERENCES users(id),
    version        INTEGER      NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_users_status ON users (status);

-- ============================================================
-- user_roles
-- ============================================================
CREATE TABLE user_roles (
    user_id  BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id  BIGINT  NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE audit_logs (
    id            BIGSERIAL    PRIMARY KEY,
    actor_id      BIGINT       REFERENCES users(id),
    action        VARCHAR(32)  NOT NULL,
    entity_type   VARCHAR(64)  NOT NULL,
    entity_no     VARCHAR(32)  NOT NULL,
    before_json   JSONB,
    after_json    JSONB,
    sensitive     BOOLEAN      NOT NULL DEFAULT false,
    trace_id      VARCHAR(64),
    occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_no);
CREATE INDEX idx_audit_logs_occurred ON audit_logs (occurred_at DESC);
CREATE INDEX idx_audit_logs_sensitive ON audit_logs (sensitive) WHERE sensitive;
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_id);

-- 시드: roles INSERT 시점에는 users 가 없으므로 created_by/updated_by 는 NULL 허용.
