ALTER TABLE `competition_venues` ADD `is_default` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `competition_venues` AS `venue`
JOIN (
	SELECT `ranked_venue`.`id`
	FROM (
		SELECT
			`candidate`.`id`,
			ROW_NUMBER() OVER (
				PARTITION BY `candidate`.`competition_id`
				ORDER BY `candidate`.`sort_order`, `candidate`.`created_at`, `candidate`.`id`
			) AS `venue_rank`
		FROM `competition_venues` AS `candidate`
	) AS `ranked_venue`
	WHERE `ranked_venue`.`venue_rank` = 1
) AS `default_venue` ON `default_venue`.`id` = `venue`.`id`
SET `venue`.`is_default` = true;
