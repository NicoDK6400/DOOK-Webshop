-- SQLite can't alter a CHECK constraint in place, so partners is rebuilt with
-- 'seller' added to the allowed status values. Sellers otherwise use the exact
-- same columns as B2B partner applicants.
CREATE TABLE partners_new (user_id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, company TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','revoked','seller')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT INTO partners_new SELECT * FROM partners;
--> statement-breakpoint
DROP TABLE partners;
--> statement-breakpoint
ALTER TABLE partners_new RENAME TO partners;
--> statement-breakpoint
ALTER TABLE trade_orders ADD COLUMN placed_by TEXT;
