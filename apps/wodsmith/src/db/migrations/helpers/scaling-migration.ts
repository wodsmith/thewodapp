import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { sql } from "drizzle-orm"
import {
	globalDefaultScalingGroup,
	globalDefaultScalingLevels,
	legacyScaleMapping,
} from "../../seeds/global-default-scaling"

/**
 * Migration helper to set up the global default scaling group
 * and migrate existing results to use the new scaling system
 */

/**
 * Step 1: Insert the global default scaling group and levels
 */
export async function insertGlobalDefaultScaling(db: BetterSQLite3Database) {
	// Insert global default scaling group
	await db.run(sql`
    INSERT INTO scaling_groups (
      id, title, description, teamId, isDefault, isSystem, createdAt, updatedAt, updateCounter
    ) VALUES (
      ${globalDefaultScalingGroup.id},
      ${globalDefaultScalingGroup.title},
      ${globalDefaultScalingGroup.description},
      ${globalDefaultScalingGroup.teamId},
      ${globalDefaultScalingGroup.isDefault},
      ${globalDefaultScalingGroup.isSystem},
      datetime('now'),
      datetime('now'),
      0
    )
  `)

	// Insert global default scaling levels
	for (const level of globalDefaultScalingLevels) {
		await db.run(sql`
      INSERT INTO scaling_levels (
        id, scalingGroupId, label, position, createdAt, updatedAt, updateCounter
      ) VALUES (
        ${level.id},
        ${level.scalingGroupId},
        ${level.label},
        ${level.position},
        datetime('now'),
        datetime('now'),
        0
      )
    `)
	}
}

/**
 * Step 2: Update all teams to use global default if they don't have a default
 */
export async function setTeamDefaultScaling(db: BetterSQLite3Database) {
	await db.run(sql`
    UPDATE team
    SET defaultScalingGroupId = ${globalDefaultScalingGroup.id},
        updatedAt = datetime('now'),
        updateCounter = updateCounter + 1
    WHERE defaultScalingGroupId IS NULL
  `)
}

/**
 * Step 3: Migrate existing results from scale enum to scalingLevelId
 */
export async function migrateResultsScaling(db: BetterSQLite3Database) {
	// Migrate Rx+ results
	await db.run(sql`
    UPDATE results
    SET scalingLevelId = ${legacyScaleMapping["rx+"].scalingLevelId},
        asRx = ${legacyScaleMapping["rx+"].asRx ? 1 : 0},
        updatedAt = datetime('now'),
        updateCounter = updateCounter + 1
    WHERE scale = 'rx+'
  `)

	// Migrate Rx results
	await db.run(sql`
    UPDATE results
    SET scalingLevelId = ${legacyScaleMapping.rx.scalingLevelId},
        asRx = ${legacyScaleMapping.rx.asRx ? 1 : 0},
        updatedAt = datetime('now'),
        updateCounter = updateCounter + 1
    WHERE scale = 'rx'
  `)

	// Migrate Scaled results
	await db.run(sql`
    UPDATE results
    SET scalingLevelId = ${legacyScaleMapping.scaled.scalingLevelId},
        asRx = ${legacyScaleMapping.scaled.asRx ? 1 : 0},
        updatedAt = datetime('now'),
        updateCounter = updateCounter + 1
    WHERE scale = 'scaled'
  `)
}

/**
 * Step 4: Verify migration success
 */
export async function verifyScalingMigration(db: BetterSQLite3Database) {
	// Check if global default exists
	const globalDefault = (await db.get(sql`
    SELECT COUNT(*) as count
    FROM scaling_groups
    WHERE id = ${globalDefaultScalingGroup.id}
  `)) as { count: number } | undefined

	if (!globalDefault || globalDefault.count === 0) {
		throw new Error("Global default scaling group not created")
	}

	// Check if all scaling levels exist
	const levels = (await db.get(sql`
    SELECT COUNT(*) as count
    FROM scaling_levels
    WHERE scalingGroupId = ${globalDefaultScalingGroup.id}
  `)) as { count: number } | undefined

	if (!levels || levels.count !== 3) {
		throw new Error("Global default scaling levels not created correctly")
	}

	// Check if any results still have scale but no scalingLevelId
	const unmigrated = (await db.get(sql`
    SELECT COUNT(*) as count
    FROM results
    WHERE scale IS NOT NULL AND scalingLevelId IS NULL
  `)) as { count: number } | undefined

	if (unmigrated && unmigrated.count > 0) {
		throw new Error(
			`${unmigrated.count} results not migrated to new scaling system`,
		)
	}

	return true
}

/**
 * Main migration function to run all steps
 */
export async function runScalingMigration(db: BetterSQLite3Database) {
	try {
		// Step 1: Create global defaults
		await insertGlobalDefaultScaling(db)

		// Step 2: Set team defaults
		await setTeamDefaultScaling(db)

		// Step 3: Migrate existing results
		await migrateResultsScaling(db)

		// Step 4: Verify
		await verifyScalingMigration(db)

		console.log("✅ Scaling migration completed successfully")
		return true
	} catch (error) {
		console.error("❌ Scaling migration failed:", error)
		throw error
	}
}
