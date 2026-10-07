CREATE TABLE `attributes` (
	`player_id` text NOT NULL,
	`key` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`player_id`, `key`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `buildings` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`attribute` text NOT NULL,
	`plot_x` integer NOT NULL,
	`plot_y` integer NOT NULL,
	`completions` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buildings_plot_uq` ON `buildings` (`player_id`,`plot_x`,`plot_y`);--> statement-breakpoint
CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`quest_id` text NOT NULL,
	`attribute` text NOT NULL,
	`date` text NOT NULL,
	`xp` integer NOT NULL,
	`gold` integer NOT NULL,
	`crit` integer DEFAULT false NOT NULL,
	`mini` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `completions_player_date_idx` ON `completions` (`player_id`,`date`);--> statement-breakpoint
CREATE INDEX `completions_quest_date_idx` ON `completions` (`quest_id`,`date`);--> statement-breakpoint
CREATE TABLE `day_records` (
	`player_id` text NOT NULL,
	`date` text NOT NULL,
	`hp_lost` integer DEFAULT 0 NOT NULL,
	`shields_used` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`player_id`, `date`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `decorations` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`plot_x` integer,
	`plot_y` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decorations_plot_uq` ON `decorations` (`player_id`,`plot_x`,`plot_y`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_player_idx` ON `events` (`player_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`player_id` text NOT NULL,
	`date` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`mood` integer,
	PRIMARY KEY(`player_id`, `date`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`name` text NOT NULL,
	`place_type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`deadline` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`reward_xp` integer DEFAULT 0 NOT NULL,
	`reward_gold` integer DEFAULT 0 NOT NULL,
	`reward_title` text,
	`pos_x` integer DEFAULT 0 NOT NULL,
	`pos_y` integer DEFAULT 0 NOT NULL,
	`cleared_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locations_player_idx` ON `locations` (`player_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT 'Hero' NOT NULL,
	`town_name` text DEFAULT 'Hearthvale' NOT NULL,
	`theme` text DEFAULT 'forest' NOT NULL,
	`avatar_json` text DEFAULT '{}' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`hp` integer DEFAULT 100 NOT NULL,
	`max_hp` integer DEFAULT 100 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_email_unique` ON `players` (`email`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`reward_id` text NOT NULL,
	`cost` integer NOT NULL,
	`purchased_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quests` (
	`id` text PRIMARY KEY NOT NULL,
	`building_id` text NOT NULL,
	`title` text NOT NULL,
	`mini_title` text DEFAULT '' NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`attribute` text NOT NULL,
	`schedule_json` text DEFAULT '[]' NOT NULL,
	`daily_cap` integer DEFAULT 1 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`shields` integer DEFAULT 0 NOT NULL,
	`last_done_date` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quests_building_idx` ON `quests` (`building_id`);--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`title` text NOT NULL,
	`cost` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stage_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`kind` text NOT NULL,
	`attribute` text,
	`min_level` integer,
	`quest_id` text,
	`count` integer,
	`window_days` integer,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stage_requirements_stage_idx` ON `stage_requirements` (`stage_id`);--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`ord` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`cleared_at` text,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stages_order_uq` ON `stages` (`location_id`,`ord`);--> statement-breakpoint
CREATE TABLE `titles` (
	`player_id` text NOT NULL,
	`title_id` text NOT NULL,
	`earned_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`player_id`, `title_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
