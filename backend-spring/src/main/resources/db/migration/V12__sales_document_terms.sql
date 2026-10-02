-- 기존 문서의 조건은 현재 거래처 기준으로 보완하며, 이후 신규 문서는 생성 당시 조건을 보관한다.
ALTER TABLE quotations ADD COLUMN payment_terms INTEGER NOT NULL DEFAULT 0 CHECK (payment_terms >= 0);
ALTER TABLE quotations ADD COLUMN lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0);
UPDATE quotations q SET payment_terms = p.payment_terms, lead_time_days = p.lead_time_days
FROM partners p WHERE q.customer_id = p.id;

ALTER TABLE sales_orders ADD COLUMN payment_terms INTEGER NOT NULL DEFAULT 0 CHECK (payment_terms >= 0);
ALTER TABLE sales_orders ADD COLUMN lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0);
UPDATE sales_orders s SET payment_terms = p.payment_terms, lead_time_days = p.lead_time_days
FROM partners p WHERE s.customer_id = p.id;
UPDATE sales_orders s SET payment_terms = q.payment_terms, lead_time_days = q.lead_time_days
FROM quotations q WHERE s.quotation_id = q.id;
