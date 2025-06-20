# Drizzle Migration Guide

**Your Task: Your job is to migrate the database to the new schema. You'll use drizzle-kit and wrangler to accomplish this.**

## Steps to complete

### Create a migration file 
Run `drizzle-kit generate` to create a schema file from drizzle representing the changes we want to apply.

This will create a new file in drizzle folder in the root of the file.

### Modify the migration file

For the migration to succeed, we need to defer foreign key rules because we are using SQLite which means we need to drop tables to update columns. 

To do this you will add `PRAGMA defer_foreign_keys = ON;` to the top and `PRAGMA defer_foreign_keys = OFF;` to the bottom of the file. Replace whatever lines are there already. 

#### Example migration file 

```sql
PRAGMA defer_foreign_keys = ON;

-- 1. Create new table without 'scale'
CREATE TABLE results_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  date INTEGER NOT NULL,
  workout_id TEXT,
  type TEXT NOT NULL,
  notes TEXT,
  wod_score TEXT,
  set_count INTEGER,
  distance INTEGER,
  time INTEGER,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (workout_id) REFERENCES workouts(id)
);

-- 2. Copy data (excluding 'scale')
INSERT INTO results_new (id, user_id, date, workout_id, type, notes, wod_score, set_count, distance, time)
SELECT id, user_id, date, workout_id, type, notes, wod_score, set_count, distance, time FROM results;

-- 3. Drop old table
DROP TABLE results;

-- 4. Rename new table
ALTER TABLE results_new RENAME TO results;

PRAGMA defer_foreign_keys = OFF;
```

This is important, double check you got this right.

### Apply changes with wrangler

Before starting, reference [cli-wrangler.mdc](mdc:.cursor/rules/cli-wrangler.mdc) to understand how the wrangler cli works. 

**IMPORTANT: ALWAYS USE THE --local FLAG** when the migration works locally someone else will apply these changes to production

now run `wrangler d1 migrations apply wodsmith-db --local` to actually apply changes to the database.

