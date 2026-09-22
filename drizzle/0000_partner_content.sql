CREATE TABLE site_owner (slot INTEGER PRIMARY KEY CHECK(slot=1), user_id TEXT NOT NULL UNIQUE);
--> statement-breakpoint
CREATE TABLE partners (user_id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, company TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','revoked')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE prices (sku TEXT PRIMARY KEY NOT NULL, model TEXT NOT NULL, colour TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL CHECK(amount>=0));
