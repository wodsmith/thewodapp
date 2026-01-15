import Database from 'better-sqlite3'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe, it, expect, beforeEach} from 'vitest'

/**
 * Migration test for 0072_competition-dates-to-text.sql
 *
 * This tests that integer timestamps are correctly converted to YYYY-MM-DD strings.
 * The migration handles the timezone bug where UTC midnight timestamps display
 * incorrectly in local time.
 */
describe('Migration 0072: competition dates to text', () => {
  let db: Database.Database

  // Create the OLD schema with integer date columns (camelCase to match current schema)
  const createOldSchema = () => {
    db.exec(`
      CREATE TABLE "team" (
        "id" TEXT PRIMARY KEY NOT NULL
      );

      CREATE TABLE "competition_groups" (
        "id" TEXT PRIMARY KEY NOT NULL
      );

      CREATE TABLE "competitions" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "createdAt" INTEGER DEFAULT (unixepoch()) NOT NULL,
        "updatedAt" INTEGER DEFAULT (unixepoch()) NOT NULL,
        "updateCounter" INTEGER DEFAULT 0,
        "organizingTeamId" TEXT NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
        "competitionTeamId" TEXT NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
        "groupId" TEXT REFERENCES "competition_groups"("id") ON DELETE SET NULL,
        "slug" TEXT(255) NOT NULL UNIQUE,
        "name" TEXT(255) NOT NULL,
        "description" TEXT(2000),
        "startDate" INTEGER NOT NULL,
        "endDate" INTEGER NOT NULL,
        "registrationOpensAt" INTEGER,
        "registrationClosesAt" INTEGER,
        "settings" TEXT(10000),
        "defaultRegistrationFeeCents" INTEGER DEFAULT 0,
        "platformFeePercentage" INTEGER,
        "platformFeeFixed" INTEGER,
        "passStripeFeesToCustomer" INTEGER DEFAULT false,
        "passPlatformFeesToCustomer" INTEGER DEFAULT true,
        "visibility" TEXT(10) DEFAULT 'public' NOT NULL,
        "status" TEXT(20) DEFAULT 'draft' NOT NULL,
        "profileImageUrl" TEXT(600),
        "bannerImageUrl" TEXT(600),
        "defaultHeatsPerRotation" INTEGER DEFAULT 4,
        "defaultLaneShiftPattern" TEXT(20) DEFAULT 'stay'
      );

      CREATE INDEX "competitions_organizing_team_idx" ON "competitions" ("organizingTeamId");
      CREATE INDEX "competitions_group_idx" ON "competitions" ("groupId");
      CREATE INDEX "competitions_status_idx" ON "competitions" ("status");
      CREATE INDEX "competitions_start_date_idx" ON "competitions" ("startDate");
    `)
  }

  beforeEach(() => {
    db = new Database(':memory:')
    createOldSchema()

    // Insert required foreign key references
    db.exec(`INSERT INTO "team" ("id") VALUES ('team1'), ('team2')`)
  })

  it('converts integer timestamps to YYYY-MM-DD strings', () => {
    // Insert test data with known timestamps
    // 1704067200 = 2024-01-01 00:00:00 UTC
    // 1704153600 = 2024-01-02 00:00:00 UTC
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "startDate", "endDate"
      ) VALUES (
        'comp1', 'team1', 'team2', 'test-comp', 'Test Competition',
        1704067200, 1704153600
      )
    `)

    // Run the migration
    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0072_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    // Verify the conversion
    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp1') as {
      startDate: string
      endDate: string
    }

    expect(row.startDate).toBe('2024-01-01')
    expect(row.endDate).toBe('2024-01-02')
  })

  it('converts registration dates correctly', () => {
    // 1703980800 = 2023-12-31 00:00:00 UTC (registration opens)
    // 1704240000 = 2024-01-03 00:00:00 UTC (registration closes)
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "startDate", "endDate", "registrationOpensAt", "registrationClosesAt"
      ) VALUES (
        'comp2', 'team1', 'team2', 'test-comp-2', 'Test Competition 2',
        1704067200, 1704153600, 1703980800, 1704240000
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0072_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp2') as {
      startDate: string
      endDate: string
      registrationOpensAt: string | null
      registrationClosesAt: string | null
    }

    expect(row.registrationOpensAt).toBe('2023-12-31')
    expect(row.registrationClosesAt).toBe('2024-01-03')
  })

  it('handles null registration dates', () => {
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "startDate", "endDate", "registrationOpensAt", "registrationClosesAt"
      ) VALUES (
        'comp3', 'team1', 'team2', 'test-comp-3', 'Test Competition 3',
        1704067200, 1704153600, NULL, NULL
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0072_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp3') as {
      registrationOpensAt: string | null
      registrationClosesAt: string | null
    }

    expect(row.registrationOpensAt).toBeNull()
    expect(row.registrationClosesAt).toBeNull()
  })

  it('preserves all other fields during migration', () => {
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "description", "startDate", "endDate",
        "defaultRegistrationFeeCents", "visibility", "status"
      ) VALUES (
        'comp4', 'team1', 'team2', 'test-comp-4', 'Preserved Fields Test',
        'A test description', 1704067200, 1704153600,
        5000, 'private', 'published'
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0072_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp4') as {
      name: string
      description: string
      defaultRegistrationFeeCents: number
      visibility: string
      status: string
      slug: string
    }

    expect(row.name).toBe('Preserved Fields Test')
    expect(row.description).toBe('A test description')
    expect(row.defaultRegistrationFeeCents).toBe(5000)
    expect(row.visibility).toBe('private')
    expect(row.status).toBe('published')
    expect(row.slug).toBe('test-comp-4')
  })

  it('handles idempotent migration (already text values)', () => {
    // First run the migration to convert to text
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "startDate", "endDate"
      ) VALUES (
        'comp5', 'team1', 'team2', 'test-comp-5', 'Test Competition 5',
        1704067200, 1704153600
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0072_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    // Now insert data with text dates (as if the schema was already migrated)
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "startDate", "endDate"
      ) VALUES (
        'comp6', 'team1', 'team2', 'test-comp-6', 'Test Competition 6',
        '2024-06-15', '2024-06-16'
      )
    `)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp6') as {
      startDate: string
      endDate: string
    }

    expect(row.startDate).toBe('2024-06-15')
    expect(row.endDate).toBe('2024-06-16')
  })

  it('recreates indexes after migration', () => {
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "startDate", "endDate"
      ) VALUES (
        'comp7', 'team1', 'team2', 'test-comp-7', 'Test Competition 7',
        1704067200, 1704153600
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0072_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    // Check that indexes exist
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'index' AND tbl_name = 'competitions'
         AND name NOT LIKE 'sqlite_%'`,
      )
      .all() as {name: string}[]

    const indexNames = indexes.map((i) => i.name)

    expect(indexNames).toContain('competitions_organizing_team_idx')
    expect(indexNames).toContain('competitions_group_idx')
    expect(indexNames).toContain('competitions_status_idx')
    expect(indexNames).toContain('competitions_start_date_idx')
  })

  it('converts production-like data with complex settings', () => {
    // Production-like competition data with complex settings JSON
    // 1775865600 = 2026-04-11 00:00:00 UTC (start/end date)
    // 1768780800 = 2026-01-19 00:00:00 UTC (registration opens)
    // 1775174400 = 2026-04-03 00:00:00 UTC (registration closes)
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizingTeamId", "competitionTeamId", "slug", "name",
        "description", "startDate", "endDate",
        "registrationOpensAt", "registrationClosesAt",
        "settings", "defaultRegistrationFeeCents",
        "passStripeFeesToCustomer", "visibility", "passPlatformFeesToCustomer",
        "profileImageUrl", "status", "defaultHeatsPerRotation",
        "defaultLaneShiftPattern"
      ) VALUES (
        'comp8', 'team1', 'team2',
        'test-comp-8', 'Test Competition 8',
        'Test description with signup deadline',
        1775865600, 1775865600, 1768780800, 1775174400,
        '{"divisions":{"scalingGroupId":"test_group_id"},"scoringConfig":{"algorithm":"custom"}}',
        0, 0, 'public', 1,
        'https://example.com/test-image.png',
        'draft', 4, 'shift_right'
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0072_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get(
      'comp8',
    ) as {
      startDate: string
      endDate: string
      registrationOpensAt: string
      registrationClosesAt: string
      name: string
      slug: string
      description: string
      visibility: string
      status: string
    }

    // Verify date conversions
    expect(row.startDate).toBe('2026-04-11')
    expect(row.endDate).toBe('2026-04-11')
    expect(row.registrationOpensAt).toBe('2026-01-19')
    expect(row.registrationClosesAt).toBe('2026-04-03')

    // Verify other fields preserved
    expect(row.name).toBe('Test Competition 8')
    expect(row.slug).toBe('test-comp-8')
    expect(row.description).toBe('Test description with signup deadline')
    expect(row.visibility).toBe('public')
    expect(row.status).toBe('draft')
  })
})
