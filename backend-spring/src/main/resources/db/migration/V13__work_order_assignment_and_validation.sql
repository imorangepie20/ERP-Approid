ALTER TABLE work_orders ADD COLUMN assignee VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE work_orders ADD COLUMN priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 3);
ALTER TABLE work_orders ADD CONSTRAINT ck_work_orders_actuals_nonnegative CHECK (good_qty >= 0 AND defect_qty >= 0);
ALTER TABLE work_orders ADD CONSTRAINT ck_work_orders_progress CHECK (progress BETWEEN 0 AND 100);
-- 기존 마감 실적(시드 포함)은 고치지 않고, 새 행/수정 행에 수량 정합성을 강제한다.
ALTER TABLE work_orders ADD CONSTRAINT ck_work_orders_actuals_qty CHECK (good_qty + defect_qty <= qty) NOT VALID;
