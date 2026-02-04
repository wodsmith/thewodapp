#!/usr/bin/env tsx
/**
 * Transform extracted D1 data for PlanetScale
 * - Convert epoch integer timestamps to UTC ISO 8601 datetime strings
 * - Convert integer booleans to actual booleans
 */

import fs from "node:fs"
import path from "node:path"

const extractedDir = path.join(__dirname, "extracted-data")
const transformedDir = path.join(__dirname, "transformed-data")

// Columns that are timestamps (stored as epoch integer seconds in SQLite)
const TIMESTAMP_COLUMNS = [
  "createdAt", "created_at",
  "updatedAt", "updated_at",
  "emailVerified", "email_verified",
  "lastCreditRefreshAt", "last_credit_refresh_at",
  "dateOfBirth", "date_of_birth",
  "invitedAt", "invited_at",
  "joinedAt", "joined_at",
  "expiresAt", "expires_at",
  "acceptedAt", "accepted_at",
  "stripeOnboardingCompletedAt", "stripe_onboarding_completed_at",
  "planExpiresAt", "plan_expires_at",
  "recordedAt", "recorded_at",
  "completedAt", "completed_at",
  "expirationDate", "expiration_date",
  "expirationDateProcessedAt", "expiration_date_processed_at",
  "schedulePublishedAt", "schedule_published_at",
]

// Columns that are booleans (stored as 0/1 in SQLite)
const BOOLEAN_COLUMNS = [
  "isActive", "is_active",
  "isSystemRole", "is_system_role",
  "isEditable", "is_editable",
  "isPersonalTeam", "is_personal_team",
  "passStripeFeesToCustomer", "pass_stripe_fees_to_customer",
  "passPlatformFeesToCustomer", "pass_platform_fees_to_customer",
  "isPublic", "is_public",
  "isDefault", "is_default",
  "isSystem", "is_system",
  "required",
  "forTeammates", "for_teammates",
  "asRx", "as_rx",
  "cancelAtPeriodEnd", "cancel_at_period_end",
  "isManualOverride", "is_manual_override",
]

/**
 * Convert epoch timestamp to UTC ISO 8601 datetime string
 */
function transformEpochToISO8601(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") {
    // Detect if milliseconds (value > year 2100 in seconds)
    const isMilliseconds = value > 4102444800
    const date = new Date(isMilliseconds ? value : value * 1000)
    if (isNaN(date.getTime())) return null
    // Return MySQL datetime format (UTC)
    return date.toISOString().slice(0, 19).replace("T", " ")
  }
  return null
}

function transformBoolean(value: unknown): boolean {
  return value === 1 || value === true
}

function transformRow(row: Record<string, unknown>): Record<string, unknown> {
  const transformed: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    if (TIMESTAMP_COLUMNS.includes(key)) {
      transformed[key] = transformEpochToISO8601(value)
    } else if (BOOLEAN_COLUMNS.includes(key)) {
      transformed[key] = transformBoolean(value)
    } else {
      transformed[key] = value
    }
  }

  return transformed
}

async function main() {
  fs.mkdirSync(transformedDir, { recursive: true })

  const manifestPath = path.join(extractedDir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    console.error("manifest.json not found. Run extract-d1.ts first.")
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))

  for (const table of manifest.tables) {
    const inputPath = path.join(extractedDir, `${table}.json`)
    const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"))

    const transformedData = data.map((row: Record<string, unknown>) =>
      transformRow(row)
    )

    const outputPath = path.join(transformedDir, `${table}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(transformedData, null, 2))

    console.log(`Transformed ${transformedData.length} rows for ${table}`)
  }

  // Copy manifest
  fs.copyFileSync(manifestPath, path.join(transformedDir, "manifest.json"))

  console.log("\nTransformation complete.")
}

main().catch(console.error)
