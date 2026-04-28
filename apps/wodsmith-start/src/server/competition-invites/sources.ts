/**
 * Competition Invite Sources — CRUD helpers
 *
 * Business-logic layer for `competition_invite_sources`. Each championship
 * competition has 0+ sources; each source is either a single-competition
 * reference or a series reference, never both. Division mappings and spot
 * allocations are stored per source.
 *
 * Write-time constraint: exactly one of `sourceCompetitionId` /
 * `sourceGroupId` is non-null per row. Enforced here, not at the DB
 * level, because PlanetScale does not support check constraints and we
 * want a consistent validation boundary that yields typed errors.
 */
// @lat: [[competition-invites#Sources helpers]]

import { and, asc, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
  type CompetitionInviteSourceKind,
  competitionInviteSourceDivisionAllocationsTable,
  competitionInviteSourcesTable,
} from "@/db/schemas/competition-invites"

// ============================================================================
// Types
// ============================================================================

export interface DivisionMapping {
  sourceDivisionId: string
  championshipDivisionId: string
  spots?: number | null
}

export interface CreateSourceInput {
  championshipCompetitionId: string
  kind: CompetitionInviteSourceKind
  sourceCompetitionId?: string | null
  sourceGroupId?: string | null
  directSpotsPerComp?: number | null
  globalSpots?: number | null
  divisionMappings?: DivisionMapping[] | null
  sortOrder?: number
  notes?: string | null
}

export interface UpdateSourceInput {
  id: string
  kind?: CompetitionInviteSourceKind
  sourceCompetitionId?: string | null
  sourceGroupId?: string | null
  directSpotsPerComp?: number | null
  globalSpots?: number | null
  divisionMappings?: DivisionMapping[] | null
  sortOrder?: number
  notes?: string | null
}

export class InviteSourceValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InviteSourceValidationError"
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Enforce the "exactly one of sourceCompetitionId / sourceGroupId" constraint
 * and the `kind` alignment with which column is populated. Throws an
 * `InviteSourceValidationError` on violation.
 *
 * A `kind = "series"` source with no `globalSpots` / `directSpotsPerComp`
 * set is intentionally allowed — the organizer may want to set them later
 * before actually sourcing invitees.
 */
export function assertSourceReferenceValid(input: {
  kind: CompetitionInviteSourceKind
  sourceCompetitionId?: string | null
  sourceGroupId?: string | null
}): void {
  const hasComp = !!input.sourceCompetitionId
  const hasGroup = !!input.sourceGroupId

  if (hasComp && hasGroup) {
    throw new InviteSourceValidationError(
      "Source cannot reference both a competition and a series",
    )
  }
  if (!hasComp && !hasGroup) {
    throw new InviteSourceValidationError(
      "Source must reference exactly one of a competition or a series",
    )
  }
  if (input.kind === COMPETITION_INVITE_SOURCE_KIND.COMPETITION && !hasComp) {
    throw new InviteSourceValidationError(
      'kind "competition" requires sourceCompetitionId',
    )
  }
  if (input.kind === COMPETITION_INVITE_SOURCE_KIND.SERIES && !hasGroup) {
    throw new InviteSourceValidationError(
      'kind "series" requires sourceGroupId',
    )
  }
}

// ============================================================================
// Queries
// ============================================================================

export async function listSourcesForChampionship(
  championshipCompetitionId: string,
): Promise<CompetitionInviteSource[]> {
  const db = getDb()
  return db
    .select()
    .from(competitionInviteSourcesTable)
    .where(
      eq(
        competitionInviteSourcesTable.championshipCompetitionId,
        championshipCompetitionId,
      ),
    )
    .orderBy(
      asc(competitionInviteSourcesTable.sortOrder),
      asc(competitionInviteSourcesTable.createdAt),
    )
}

export async function getSourceById(
  id: string,
): Promise<CompetitionInviteSource | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(competitionInviteSourcesTable)
    .where(eq(competitionInviteSourcesTable.id, id))
    .limit(1)
  return row ?? null
}

// ============================================================================
// Mutations
// ============================================================================

function serializeDivisionMappings(
  mappings: DivisionMapping[] | null | undefined,
): string | null {
  if (!mappings || mappings.length === 0) return null
  return JSON.stringify(mappings)
}

export async function createSource(
  input: CreateSourceInput,
): Promise<CompetitionInviteSource> {
  assertSourceReferenceValid({
    kind: input.kind,
    sourceCompetitionId: input.sourceCompetitionId,
    sourceGroupId: input.sourceGroupId,
  })

  const db = getDb()
  const values = {
    championshipCompetitionId: input.championshipCompetitionId,
    kind: input.kind,
    sourceCompetitionId: input.sourceCompetitionId ?? null,
    sourceGroupId: input.sourceGroupId ?? null,
    directSpotsPerComp: input.directSpotsPerComp ?? null,
    globalSpots: input.globalSpots ?? null,
    divisionMappings: serializeDivisionMappings(input.divisionMappings),
    sortOrder: input.sortOrder ?? 0,
    notes: input.notes ?? null,
  }

  const [inserted] = await db
    .insert(competitionInviteSourcesTable)
    .values(values)
    .$returningId()

  // MySQL insert returns only the id; re-read for canonical shape.
  const row = await getSourceById(inserted.id)
  if (!row) {
    throw new Error("Source was inserted but could not be re-read")
  }
  return row
}

export async function updateSource(
  input: UpdateSourceInput,
): Promise<CompetitionInviteSource> {
  const existing = await getSourceById(input.id)
  if (!existing) {
    throw new InviteSourceValidationError("Source not found")
  }

  const nextKind = input.kind ?? existing.kind
  const nextComp =
    input.sourceCompetitionId !== undefined
      ? input.sourceCompetitionId
      : existing.sourceCompetitionId
  const nextGroup =
    input.sourceGroupId !== undefined
      ? input.sourceGroupId
      : existing.sourceGroupId

  assertSourceReferenceValid({
    kind: nextKind,
    sourceCompetitionId: nextComp,
    sourceGroupId: nextGroup,
  })

  const db = getDb()
  const patch: Record<string, unknown> = {}
  if (input.kind !== undefined) patch.kind = input.kind
  if (input.sourceCompetitionId !== undefined)
    patch.sourceCompetitionId = input.sourceCompetitionId
  if (input.sourceGroupId !== undefined)
    patch.sourceGroupId = input.sourceGroupId
  if (input.directSpotsPerComp !== undefined)
    patch.directSpotsPerComp = input.directSpotsPerComp
  if (input.globalSpots !== undefined) patch.globalSpots = input.globalSpots
  if (input.divisionMappings !== undefined) {
    patch.divisionMappings = serializeDivisionMappings(input.divisionMappings)
  }
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.notes !== undefined) patch.notes = input.notes

  await db
    .update(competitionInviteSourcesTable)
    .set(patch)
    .where(eq(competitionInviteSourcesTable.id, input.id))

  const row = await getSourceById(input.id)
  if (!row) {
    throw new Error("Source was updated but could not be re-read")
  }
  return row
}

export async function deleteSource(input: {
  id: string
  championshipCompetitionId: string
}): Promise<boolean> {
  const db = getDb()
  // Cascade delete the source's per-division allocation rows in the same
  // transaction (no FKs per PlanetScale convention — the cascade lives
  // here). Tx is the same primitive division capacity uses; PlanetScale
  // supports it.
  return await db.transaction(async (tx) => {
    // Verify the source belongs to the named championship before any
    // delete fires. Otherwise a caller authorized for championship A
    // could pass a sourceId from championship B and wipe its
    // allocation rows cross-tenant — the source-row delete below is
    // championship-scoped, but the allocations delete is keyed only by
    // sourceId.
    const [existing] = await tx
      .select({ id: competitionInviteSourcesTable.id })
      .from(competitionInviteSourcesTable)
      .where(
        and(
          eq(competitionInviteSourcesTable.id, input.id),
          eq(
            competitionInviteSourcesTable.championshipCompetitionId,
            input.championshipCompetitionId,
          ),
        ),
      )
      .limit(1)
    if (!existing) return false

    await tx
      .delete(competitionInviteSourceDivisionAllocationsTable)
      .where(
        eq(competitionInviteSourceDivisionAllocationsTable.sourceId, input.id),
      )
    await tx
      .delete(competitionInviteSourcesTable)
      .where(eq(competitionInviteSourcesTable.id, input.id))
    return true
  })
}
