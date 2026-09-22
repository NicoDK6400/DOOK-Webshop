CREATE INDEX `catalogue_items_model_idx` ON `catalogue_items` (`model`);--> statement-breakpoint
CREATE INDEX `trade_orders_user_created_idx` ON `trade_orders` (`user_id`,`created_at`);