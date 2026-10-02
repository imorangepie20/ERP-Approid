-- Existing orders have no historical routing snapshot; do not invent one from today's master.
ALTER TABLE work_orders ADD COLUMN routing_steps JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE work_orders ADD CONSTRAINT ck_work_orders_routing_steps CHECK (jsonb_typeof(routing_steps) = 'array');
