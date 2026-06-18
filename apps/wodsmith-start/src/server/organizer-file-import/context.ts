import "server-only"

import { env } from "cloudflare:workers"
import { and, desc, eq, ne } from "drizzle-orm"
import { getDb } from "@/db"
import {
  AGENT_IMPORT_STATUS,
  type AgentImportRun,
  agentImportRunsTable,
  programmingTracksTable,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
  trackWorkoutsTable,
  userTable,
  type VolunteerMembershipMetadata,
  workouts,
} from "@/db/schema"
import {
  type ParsedFile,
  parseImportFile,
} from "@/lib/organizer-file-import/parse"
import type {
  ExistingEvent,
  ExistingVolunteer,
} from "@/lib/organizer-file-import/validate"

/**
 * Server-only context loaders for the organizer file-drop import agent.
 *
 * These return flat, pre-formatted facts the model matches against — existing
 * volunteers/invites and existing events — plus the parsed contents of the
 * dropped file (read privately from R2). The model never sees raw DB rows.
 */

function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim()
  return name || null
}

function parseMetadata(
  raw: string | null,
): (VolunteerMembershipMetadata & { inviteName?: string }) | null {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Existing volunteers for dedup matching: confirmed memberships (volunteer
 * system role) plus pending invitations. Email is the dedup key.
 */
export async function loadExistingVolunteers(
  competitionTeamId: string,
): Promise<ExistingVolunteer[]> {
  const db = getDb()

  const memberships = await db
    .select({
      membershipId: teamMembershipTable.id,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
    })
    .from(teamMembershipTable)
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.teamId, competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    )

  const invitations = await db.query.teamInvitationTable.findMany({
    where: and(
      eq(teamInvitationTable.teamId, competitionTeamId),
      eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
      eq(teamInvitationTable.isSystemRole, true),
    ),
    columns: { id: true, email: true, metadata: true, acceptedAt: true },
  })

  const fromMemberships: ExistingVolunteer[] = memberships.map((m) => ({
    membershipId: m.membershipId,
    email: m.email ?? null,
    name: fullName(m.firstName, m.lastName) ?? m.email ?? null,
    isInvite: false,
  }))

  const fromInvites: ExistingVolunteer[] = invitations
    // An accepted invite is represented by a membership above; skip to avoid dupes.
    .filter((inv) => !inv.acceptedAt)
    .map((inv) => ({
      membershipId: inv.id,
      email: inv.email,
      name: parseMetadata(inv.metadata)?.inviteName ?? null,
      isInvite: true,
    }))

  return [...fromMemberships, ...fromInvites]
}

/** Existing competition events for update targeting + duplicate detection. */
export async function loadExistingEvents(
  competitionId: string,
): Promise<ExistingEvent[]> {
  const db = getDb()
  const rows = await db
    .select({
      trackWorkoutId: trackWorkoutsTable.id,
      workoutId: workouts.id,
      name: workouts.name,
      scheme: workouts.scheme,
      scoreType: workouts.scoreType,
      description: workouts.description,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(eq(programmingTracksTable.competitionId, competitionId))

  return rows.map((r) => ({
    trackWorkoutId: r.trackWorkoutId,
    workoutId: r.workoutId,
    name: r.name,
    scheme: r.scheme,
    scoreType: r.scoreType ?? null,
    description: r.description ?? null,
  }))
}

export interface PriorImport {
  appliedAt: Date | null
  originalFilename: string | null
}

/**
 * Find a previously APPLIED import of the same file (by checksum) in this
 * competition, excluding the current run. Powers a "you already imported this"
 * warning so an organizer doesn't accidentally double-apply a re-dropped file.
 */
export async function findPriorAppliedImport(
  competitionId: string,
  checksum: string,
  excludeRunId: string,
): Promise<PriorImport | null> {
  const db = getDb()
  const rows = await db
    .select({
      appliedAt: agentImportRunsTable.appliedAt,
      originalFilename: agentImportRunsTable.originalFilename,
    })
    .from(agentImportRunsTable)
    .where(
      and(
        eq(agentImportRunsTable.competitionId, competitionId),
        eq(agentImportRunsTable.checksum, checksum),
        eq(agentImportRunsTable.status, AGENT_IMPORT_STATUS.APPLIED),
        ne(agentImportRunsTable.id, excludeRunId),
      ),
    )
    .orderBy(desc(agentImportRunsTable.appliedAt))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    appliedAt: row.appliedAt ?? null,
    originalFilename: row.originalFilename ?? null,
  }
}

/**
 * Read the dropped file from its private R2 key and parse it. Throws if the run
 * has no uploaded object or the type is unsupported.
 */
export async function readImportFile(run: AgentImportRun): Promise<ParsedFile> {
  if (!run.r2Key) {
    throw new Error("Import run has no uploaded file yet")
  }
  const object = await env.R2_BUCKET.get(run.r2Key)
  if (!object) {
    throw new Error("Uploaded file not found in storage")
  }
  const bytes = await object.arrayBuffer()
  return parseImportFile({
    bytes,
    mimeType: run.mimeType ?? "",
    filename: run.originalFilename ?? "upload",
  })
}
