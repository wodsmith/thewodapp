CREATE INDEX `programming_track_scaling_idx` ON `programming_track` (`scalingGroupId`);--> statement-breakpoint
CREATE INDEX `team_default_scaling_idx` ON `team` (`defaultScalingGroupId`);--> statement-breakpoint
CREATE INDEX `workouts_scaling_group_idx` ON `workouts` (`scaling_group_id`);--> statement-breakpoint
CREATE INDEX `workouts_team_idx` ON `workouts` (`team_id`);--> statement-breakpoint
CREATE INDEX `workouts_source_track_idx` ON `workouts` (`source_track_id`);