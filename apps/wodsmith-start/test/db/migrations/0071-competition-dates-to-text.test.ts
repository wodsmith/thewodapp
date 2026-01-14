import Database from 'better-sqlite3'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe, it, expect, beforeEach} from 'vitest'

/**
 * Migration test for 0071_competition-dates-to-text.sql
 *
 * This tests that integer timestamps are correctly converted to YYYY-MM-DD strings.
 * The migration handles the timezone bug where UTC midnight timestamps display
 * incorrectly in local time.
 */
describe('Migration 0071: competition dates to text', () => {
  let db: Database.Database

  // Create the OLD schema with integer date columns (snake_case to match committed migration)
  const createOldSchema = () => {
    db.exec(`
      CREATE TABLE "teams" (
        "id" TEXT PRIMARY KEY NOT NULL
      );

      CREATE TABLE "competition_groups" (
        "id" TEXT PRIMARY KEY NOT NULL
      );

      CREATE TABLE "programming_tracks" (
        "id" TEXT PRIMARY KEY NOT NULL
      );

      CREATE TABLE "competitions" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
        "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
        "organizing_team_id" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "competition_team_id" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "group_id" TEXT REFERENCES "competition_groups"("id") ON DELETE SET NULL,
        "slug" TEXT(255) NOT NULL UNIQUE,
        "name" TEXT(255) NOT NULL,
        "description" TEXT(2000),
        "start_date" INTEGER NOT NULL,
        "end_date" INTEGER NOT NULL,
        "registration_opens_at" INTEGER,
        "registration_closes_at" INTEGER,
        "settings" TEXT(10000),
        "default_registration_fee_cents" INTEGER DEFAULT 0,
        "platform_fee_percentage" INTEGER,
        "platform_fee_fixed" INTEGER,
        "pass_stripe_fees_to_customer" INTEGER DEFAULT false,
        "pass_platform_fees_to_customer" INTEGER DEFAULT true,
        "visibility" TEXT(10) DEFAULT 'public' NOT NULL,
        "status" TEXT(20) DEFAULT 'draft' NOT NULL,
        "banner_image_url" TEXT(500),
        "logo_image_url" TEXT(500),
        "track_id" TEXT REFERENCES "programming_tracks"("id") ON DELETE SET NULL
      );

      CREATE INDEX "competitions_organizing_team_idx" ON "competitions" ("organizing_team_id");
      CREATE INDEX "competitions_group_idx" ON "competitions" ("group_id");
      CREATE INDEX "competitions_status_idx" ON "competitions" ("status");
    `)
  }

  beforeEach(() => {
    db = new Database(':memory:')
    createOldSchema()

    // Insert required foreign key references
    db.exec(`INSERT INTO "teams" ("id") VALUES ('team1'), ('team2')`)
  })

  it('converts integer timestamps to YYYY-MM-DD strings', () => {
    // Insert test data with known timestamps
    // 1704067200 = 2024-01-01 00:00:00 UTC
    // 1704153600 = 2024-01-02 00:00:00 UTC
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizing_team_id", "competition_team_id", "slug", "name",
        "start_date", "end_date"
      ) VALUES (
        'comp1', 'team1', 'team2', 'test-comp', 'Test Competition',
        1704067200, 1704153600
      )
    `)

    // Run the migration
    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0071_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    // Verify the conversion
    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp1') as {
      start_date: string
      end_date: string
    }

    expect(row.start_date).toBe('2024-01-01')
    expect(row.end_date).toBe('2024-01-02')
  })

  it('converts registration dates correctly', () => {
    // 1703980800 = 2023-12-31 00:00:00 UTC (registration opens)
    // 1704240000 = 2024-01-03 00:00:00 UTC (registration closes)
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizing_team_id", "competition_team_id", "slug", "name",
        "start_date", "end_date", "registration_opens_at", "registration_closes_at"
      ) VALUES (
        'comp2', 'team1', 'team2', 'test-comp-2', 'Test Competition 2',
        1704067200, 1704153600, 1703980800, 1704240000
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0071_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp2') as {
      start_date: string
      end_date: string
      registration_opens_at: string | null
      registration_closes_at: string | null
    }

    expect(row.registration_opens_at).toBe('2023-12-31')
    expect(row.registration_closes_at).toBe('2024-01-03')
  })

  it('handles null registration dates', () => {
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizing_team_id", "competition_team_id", "slug", "name",
        "start_date", "end_date", "registration_opens_at", "registration_closes_at"
      ) VALUES (
        'comp3', 'team1', 'team2', 'test-comp-3', 'Test Competition 3',
        1704067200, 1704153600, NULL, NULL
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0071_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp3') as {
      registration_opens_at: string | null
      registration_closes_at: string | null
    }

    expect(row.registration_opens_at).toBeNull()
    expect(row.registration_closes_at).toBeNull()
  })

  it('preserves all other fields during migration', () => {
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizing_team_id", "competition_team_id", "slug", "name",
        "description", "start_date", "end_date",
        "default_registration_fee_cents", "visibility", "status"
      ) VALUES (
        'comp4', 'team1', 'team2', 'test-comp-4', 'Preserved Fields Test',
        'A test description', 1704067200, 1704153600,
        5000, 'private', 'published'
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0071_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp4') as {
      name: string
      description: string
      default_registration_fee_cents: number
      visibility: string
      status: string
      slug: string
    }

    expect(row.name).toBe('Preserved Fields Test')
    expect(row.description).toBe('A test description')
    expect(row.default_registration_fee_cents).toBe(5000)
    expect(row.visibility).toBe('private')
    expect(row.status).toBe('published')
    expect(row.slug).toBe('test-comp-4')
  })

  it('handles idempotent migration (already text values)', () => {
    // First run the migration to convert to text
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizing_team_id", "competition_team_id", "slug", "name",
        "start_date", "end_date"
      ) VALUES (
        'comp5', 'team1', 'team2', 'test-comp-5', 'Test Competition 5',
        1704067200, 1704153600
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0071_competition-dates-to-text.sql',
    )
    const migration = readFileSync(migrationPath, 'utf-8')
    db.exec(migration)

    // Now insert data with text dates (as if the schema was already migrated)
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizing_team_id", "competition_team_id", "slug", "name",
        "start_date", "end_date"
      ) VALUES (
        'comp6', 'team1', 'team2', 'test-comp-6', 'Test Competition 6',
        '2024-06-15', '2024-06-16'
      )
    `)

    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('comp6') as {
      start_date: string
      end_date: string
    }

    expect(row.start_date).toBe('2024-06-15')
    expect(row.end_date).toBe('2024-06-16')
  })

  it('recreates indexes after migration', () => {
    db.exec(`
      INSERT INTO "competitions" (
        "id", "organizing_team_id", "competition_team_id", "slug", "name",
        "start_date", "end_date"
      ) VALUES (
        'comp7', 'team1', 'team2', 'test-comp-7', 'Test Competition 7',
        1704067200, 1704153600
      )
    `)

    const migrationPath = join(
      process.cwd(),
      'src/db/migrations/0071_competition-dates-to-text.sql',
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
  })
})
