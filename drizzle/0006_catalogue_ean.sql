-- EAN is the shared identifier planned for matching website SKUs against Uniconta. It is
-- optional per item (not all rows are populated yet) and only ever exposed via admin-only
-- endpoints, never the public catalogue.
ALTER TABLE catalogue_items ADD COLUMN ean TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX catalogue_items_ean_unique ON catalogue_items(ean) WHERE ean IS NOT NULL;
