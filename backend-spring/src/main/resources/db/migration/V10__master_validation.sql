-- Keep shared migrations unchanged; enforce the new master input boundaries in the DB.
ALTER TABLE boms ADD CONSTRAINT ck_boms_no_self CHECK (parent_id <> child_id);
ALTER TABLE boms ADD CONSTRAINT ck_boms_loss_rate CHECK (loss_rate BETWEEN 0 AND 100);
ALTER TABLE routings ADD CONSTRAINT ck_routings_std_time CHECK (std_time >= 0);
