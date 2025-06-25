PRAGMA defer_foreign_keys = ON;

ALTER TABLE workouts RENAME COLUMN user_id TO team_id;

UPDATE workouts
SET team_id = (
    SELECT id
    FROM team
    WHERE team.personalTeamOwnerId = workouts.team_id
)
WHERE EXISTS (
    SELECT 1
    FROM team
    WHERE team.personalTeamOwnerId = workouts.team_id
);

CREATE TABLE workouts_new (
	createdAt integer NOT NULL,
	updatedAt integer NOT NULL,
	updateCounter integer DEFAULT 0,
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	description text NOT NULL,
	scope text DEFAULT 'private' NOT NULL,
	scheme text NOT NULL,
	reps_per_round integer,
	rounds_to_score integer DEFAULT 1,
	team_id text,
	sugar_id text,
	tiebreak_scheme text,
	secondary_scheme text,
	source_track_id text,
	FOREIGN KEY (team_id) REFERENCES team(id) ON UPDATE no action ON DELETE no action
);

INSERT INTO workouts_new (createdAt, updatedAt, updateCounter, id, name, description, scope, scheme, reps_per_round, rounds_to_score, team_id, sugar_id, tiebreak_scheme, secondary_scheme, source_track_id)
SELECT createdAt, updatedAt, updateCounter, id, name, description, scope, scheme, reps_per_round, rounds_to_score, team_id, sugar_id, tiebreak_scheme, secondary_scheme, source_track_id
FROM workouts;

DROP TABLE workouts;

ALTER TABLE workouts_new RENAME TO workouts;

PRAGMA defer_foreign_keys = OFF;
