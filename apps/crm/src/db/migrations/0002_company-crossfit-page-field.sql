INSERT OR IGNORE INTO `fields` (
	`id`,
	`object_id`,
	`name`,
	`description`,
	`type`,
	`required`,
	`sort_order`,
	`created_at`,
	`updated_at`
)
SELECT
	lower(hex(randomblob(16))),
	`objects`.`id`,
	'CrossFit Page',
	'Official CrossFit affiliate profile URL',
	'url',
	false,
	70,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM `objects`
WHERE `objects`.`name` = 'Company';
