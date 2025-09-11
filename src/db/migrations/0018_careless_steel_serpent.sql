PRAGMA defer_foreign_keys = ON;

-- 1. Create new table with workoutId field
CREATE TABLE `__new_scheduled_workout_instance` (
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updateCounter` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`trackWorkoutId` text NOT NULL,
	`workoutId` text,
	`scheduledDate` integer NOT NULL,
	`teamSpecificNotes` text(1000),
	`scalingGuidanceForDay` text(1000),
	`classTimes` text(500),
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackWorkoutId`) REFERENCES `track_workout`(`id`) ON UPDATE no action ON DELETE no action
);

-- 2. Copy data and backfill workoutId from track_workout
INSERT INTO `__new_scheduled_workout_instance`("createdAt", "updatedAt", "updateCounter", "id", "teamId", "trackWorkoutId", "workoutId", "scheduledDate", "teamSpecificNotes", "scalingGuidanceForDay", "classTimes") 
SELECT 
    si."createdAt", 
    si."updatedAt", 
    si."updateCounter", 
    si."id", 
    si."teamId", 
    si."trackWorkoutId", 
    tw."workoutId" as "workoutId",  -- Backfill with original workout from track
    si."scheduledDate", 
    si."teamSpecificNotes", 
    si."scalingGuidanceForDay", 
    si."classTimes" 
FROM `scheduled_workout_instance` si
LEFT JOIN `track_workout` tw ON si."trackWorkoutId" = tw."id";

-- 3. Drop old table
DROP TABLE `scheduled_workout_instance`;

-- 4. Rename new table
ALTER TABLE `__new_scheduled_workout_instance` RENAME TO `scheduled_workout_instance`;

-- 5. Create indexes
CREATE INDEX `scheduled_workout_instance_team_idx` ON `scheduled_workout_instance` (`teamId`);
CREATE INDEX `scheduled_workout_instance_date_idx` ON `scheduled_workout_instance` (`scheduledDate`);
CREATE INDEX `scheduled_workout_instance_workout_idx` ON `scheduled_workout_instance` (`workoutId`);

PRAGMA defer_foreign_keys = OFF;