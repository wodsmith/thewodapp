/**
 * Competition Invite Server Functions
 *
 * Phase 1 exposes CRUD over `competition_invite_sources`, plus the roster
 * computation (added in a later commit). Every mutation requires
 * `MANAGE_COMPETITIONS` on the championship's organizing team. When a
 * source references another competition or series, we also require
 * `MANAGE_COMPETITIONS` on that source's organizing team.
 *
 * Per ADR Open Question 6 (same-org only for MVP), the source's
 * organizing team must currently match the championship's organizing
 * team. This is a soft policy implemented here; the schema keeps the
 * generality so we can relax the rule in a future phase by dropping this
 * check.
 */
// @lat: [[competition-invites#Source server fns]]

import { render } from "@react-email/render"
import { createServerFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_SOURCE_KIND,
  COMPETITION_INVITE_STATUS,
  competitionInvitesTable,
  type CompetitionInvite,
  type CompetitionInviteRound,
} from "@/db/schemas/competition-invites"
import {
  competitionGroupsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { getAppUrl } from "@/lib/env"
import {
  logEntityCreated,
  logEntityDeleted,
  logEntityUpdated,
  logError,
  logInfo,
  logWarning,
  withRequestContext,
} from "@/lib/logging"
import { CompetitionInviteEmail } from "@/react-email/competition-invites/invite-email"
import {
  type InviteEmailMessage,
  type QueueEmailMessage,
} from "@/server/broadcast-queue-consumer"
import {
  assertInviteClaimable,
  type InviteClaimableError,
  InviteNotClaimableError,
  resolveInviteByToken,
} from "@/server/competition-invites/claim"
import { declineInvite } from "@/server/competition-invites/decline"
import {
  createBespokeInvite as createBespokeInviteHelper,
  createBespokeInvitesBulk as createBespokeInvitesBulkHelper,
} from "@/server/competition-invites/bespoke"
import {
  FreeCompetitionNotEligibleError,
  issueInvitesForRecipients,
  type IssueInviteRecipient,
  type IssueInvitesResult,
  normalizeInviteEmail,
  reissueInvite,
} from "@/server/competition-invites/issue"
import { getChampionshipRoster } from "@/server/competition-invites/roster"
import {
  beginSendingRound,
  createRoundDraft,
  finalizeRoundSend,
  getRoundById,
  listRoundsForChampionship,
  markRoundFailed,
  RoundStateConflictError,
  RoundValidationError,
  updateRoundDraft,
} from "@/server/competition-invites/rounds"
import {
  createSource,
  deleteSource,
  getSourceById,
  listSourcesForChampionship,
  updateSource,
} from "@/server/competition-invites/sources"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "./requireTeamMembership"

// ============================================================================
// Input Schemas
// ============================================================================

const divisionMappingSchema = z.object({
  sourceDivisionId: z.string().min(1),
  championshipDivisionId: z.string().min(1),
  spots: z.number().int().positive().nullable().optional(),
})

const kindSchema = z.enum([
  COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
  COMPETITION_INVITE_SOURCE_KIND.SERIES,
])

const listInviteSourcesInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
})

const createInviteSourceInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  kind: kindSchema,
  sourceCompetitionId: z.string().min(1).nullable().optional(),
  sourceGroupId: z.string().min(1).nullable().optional(),
  directSpotsPerComp: z.number().int().positive().nullable().optional(),
  globalSpots: z.number().int().positive().nullable().optional(),
  divisionMappings: z.array(divisionMappingSchema).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const updateInviteSourceInputSchema = z.object({
  id: z.string().min(1),
  championshipCompetitionId: z.string().min(1),
  kind: kindSchema.optional(),
  sourceCompetitionId: z.string().min(1).nullable().optional(),
  sourceGroupId: z.string().min(1).nullable().optional(),
  directSpotsPerComp: z.number().int().positive().nullable().optional(),
  globalSpots: z.number().int().positive().nullable().optional(),
  divisionMappings: z.array(divisionMappingSchema).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const deleteInviteSourceInputSchema = z.object({
  id: z.string().min(1),
  championshipCompetitionId: z.string().min(1),
})

const getChampionshipRosterInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  divisionId: z.string().min(1),
  filters: z
    .object({
      statuses: z.array(z.string()).optional(),
    })
    .optional(),
})

const getInviteByTokenInputSchema = z.object({
  token: z.string().min(1),
  slug: z.string().min(1),
})

const declineInviteInputSchema = z.object({
  token: z.string().min(1),
  slug: z.string().min(1),
})

const issueInvitesRecipientSchema = z.object({
  email: z.string().email().max(255),
  origin: z.enum([COMPETITION_INVITE_ORIGIN.SOURCE, COMPETITION_INVITE_ORIGIN.BESPOKE]),
  sourceId: z.string().min(1).nullable().optional(),
  sourceCompetitionId: z.string().min(1).nullable().optional(),
  sourcePlacement: z.number().int().positive().nullable().optional(),
  sourcePlacementLabel: z.string().max(255).nullable().optional(),
  bespokeReason: z.string().max(255).nullable().optional(),
  inviteeFirstName: z.string().max(255).nullable().optional(),
  inviteeLastName: z.string().max(255).nullable().optional(),
  userId: z.string().min(1).nullable().optional(),
})

const issueInvitesInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  championshipDivisionId: z.string().min(1),
  rsvpDeadlineAt: z.coerce.date(),
  subject: z.string().min(1).max(255),
  bodyText: z.string().max(10_000).optional(),
  /**
   * Optional override for the round label. When omitted the server picks
   * "Round N" using the championship's next dense round number.
   */
  roundLabel: z.string().min(1).max(255).optional(),
  /**
   * If supplied, attach the new invites to an existing draft round
   * instead of creating one. The round must belong to the championship
   * and still be in `draft` status.
   */
  roundId: z.string().min(1).optional(),
  recipients: z.array(issueInvitesRecipientSchema).min(1).max(500),
})

const createRoundDraftInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  label: z.string().min(1).max(255),
  subject: z.string().min(1).max(255),
  rsvpDeadlineAt: z.coerce.date(),
  bodyJson: z.string().max(50_000).optional(),
  emailTemplateId: z.string().min(1).nullable().optional(),
  replyTo: z.string().email().nullable().optional(),
})

const updateRoundDraftInputSchema = z.object({
  id: z.string().min(1),
  championshipCompetitionId: z.string().min(1),
  label: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(255).optional(),
  rsvpDeadlineAt: z.coerce.date().optional(),
  bodyJson: z.string().max(50_000).nullable().optional(),
  emailTemplateId: z.string().min(1).nullable().optional(),
  replyTo: z.string().email().nullable().optional(),
})

const listRoundsInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
})

const getRoundDetailInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  roundId: z.string().min(1),
})

const bespokeInviteInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  championshipDivisionId: z.string().min(1),
  email: z.string().email().max(255),
  inviteeFirstName: z.string().max(255).nullable().optional(),
  inviteeLastName: z.string().max(255).nullable().optional(),
  bespokeReason: z.string().max(255).nullable().optional(),
})

const listBespokeInvitesInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  championshipDivisionId: z.string().min(1),
})

const bespokeBulkInviteInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  championshipDivisionId: z.string().min(1),
  pasteText: z.string().max(200_000),
})

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Resolve the organizing team for a competition. Throws if the
 * competition does not exist.
 *
 * Not exported: keeping this internal lets the tanstack-start compiler's
 * dead-code-elimination prune this function (and its `getDb` import
 * chain) from the client bundle. Exporting would pin the `cloudflare:workers`
 * import through `@/db` and break the dev server's client environment.
 */
async function getCompetitionOrganizingTeamId(
  competitionId: string,
): Promise<string> {
  const db = getDb()
  const [row] = await db
    .select({ organizingTeamId: competitionsTable.organizingTeamId })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)
  if (!row) throw new Error("Competition not found")
  return row.organizingTeamId
}

async function getSeriesOrganizingTeamId(groupId: string): Promise<string> {
  const db = getDb()
  const [row] = await db
    .select({ organizingTeamId: competitionGroupsTable.organizingTeamId })
    .from(competitionGroupsTable)
    .where(eq(competitionGroupsTable.id, groupId))
    .limit(1)
  if (!row) throw new Error("Series not found")
  return row.organizingTeamId
}

/**
 * Require `MANAGE_COMPETITIONS` on both the championship and any referenced
 * source (competition or series). Per ADR Open Question 6, the two
 * organizing teams must currently match (same-org only for MVP).
 *
 * The source reference is resolved via `kind` (not "whichever id is set")
 * so a request like `kind: "series"` with both a benign
 * `sourceCompetitionId` and an attacker-controlled `sourceGroupId`
 * cannot bypass the series-side permission check.
 */
async function requireSourcePermissions(params: {
  championshipCompetitionId: string
  kind: "competition" | "series"
  sourceCompetitionId?: string | null
  sourceGroupId?: string | null
}): Promise<{ championshipTeamId: string }> {
  const championshipTeamId = await getCompetitionOrganizingTeamId(
    params.championshipCompetitionId,
  )
  await requireTeamPermission(
    championshipTeamId,
    TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
  )

  let sourceTeamId: string | null = null
  if (params.kind === COMPETITION_INVITE_SOURCE_KIND.COMPETITION) {
    if (!params.sourceCompetitionId) {
      throw new Error(
        'kind "competition" requires sourceCompetitionId',
      )
    }
    sourceTeamId = await getCompetitionOrganizingTeamId(
      params.sourceCompetitionId,
    )
  } else if (params.kind === COMPETITION_INVITE_SOURCE_KIND.SERIES) {
    if (!params.sourceGroupId) {
      throw new Error('kind "series" requires sourceGroupId')
    }
    sourceTeamId = await getSeriesOrganizingTeamId(params.sourceGroupId)
  }

  if (sourceTeamId) {
    await requireTeamPermission(
      sourceTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )
    // ADR OQ6: same-org only for MVP.
    if (sourceTeamId !== championshipTeamId) {
      throw new Error(
        "Cross-organization sources are not supported yet — the source must belong to the same organization as the championship.",
      )
    }
  }

  return { championshipTeamId }
}

// ============================================================================
// Server Functions
// ============================================================================

export const listInviteSourcesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listInviteSourcesInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "listInviteSourcesFn",
        attributes: { championshipCompetitionId: data.championshipCompetitionId },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )
        const sources = await listSourcesForChampionship(
          data.championshipCompetitionId,
        )

        const competitionIds = Array.from(
          new Set(
            sources
              .map((s) => s.sourceCompetitionId)
              .filter((v): v is string => !!v),
          ),
        )
        const groupIds = Array.from(
          new Set(
            sources
              .map((s) => s.sourceGroupId)
              .filter((v): v is string => !!v),
          ),
        )

        const db = getDb()
        const [compNameRows, groupRows, seriesCompCountRows] = await Promise.all([
          competitionIds.length > 0
            ? db
                .select({
                  id: competitionsTable.id,
                  name: competitionsTable.name,
                })
                .from(competitionsTable)
                .where(inArray(competitionsTable.id, competitionIds))
            : Promise.resolve<Array<{ id: string; name: string }>>([]),
          groupIds.length > 0
            ? db
                .select({
                  id: competitionGroupsTable.id,
                  name: competitionGroupsTable.name,
                })
                .from(competitionGroupsTable)
                .where(inArray(competitionGroupsTable.id, groupIds))
            : Promise.resolve<Array<{ id: string; name: string }>>([]),
          groupIds.length > 0
            ? db
                .select({
                  groupId: competitionsTable.groupId,
                  count: sql<number>`count(*)`,
                })
                .from(competitionsTable)
                .where(inArray(competitionsTable.groupId, groupIds))
                .groupBy(competitionsTable.groupId)
            : Promise.resolve<Array<{ groupId: string | null; count: number }>>(
                [],
              ),
        ])

        const competitionNamesById: Record<string, string> = Object.fromEntries(
          compNameRows.map((r) => [r.id, r.name]),
        )
        const seriesNamesById: Record<string, string> = Object.fromEntries(
          groupRows.map((r) => [r.id, r.name]),
        )
        const seriesCompCountsById: Record<string, number> =
          Object.fromEntries(
            seriesCompCountRows
              .filter((r): r is { groupId: string; count: number } => !!r.groupId)
              .map((r) => [r.groupId, Number(r.count)]),
          )

        return {
          sources,
          competitionNamesById,
          seriesNamesById,
          seriesCompCountsById,
        }
      },
    )
  })

export const createInviteSourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createInviteSourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "createInviteSourceFn",
        attributes: { championshipCompetitionId: data.championshipCompetitionId },
      },
      async () => {
        await requireSourcePermissions({
          championshipCompetitionId: data.championshipCompetitionId,
          kind: data.kind,
          sourceCompetitionId: data.sourceCompetitionId,
          sourceGroupId: data.sourceGroupId,
        })

        const source = await createSource({
          championshipCompetitionId: data.championshipCompetitionId,
          kind: data.kind,
          sourceCompetitionId: data.sourceCompetitionId,
          sourceGroupId: data.sourceGroupId,
          directSpotsPerComp: data.directSpotsPerComp,
          globalSpots: data.globalSpots,
          divisionMappings: data.divisionMappings,
          sortOrder: data.sortOrder,
          notes: data.notes,
        })

        logEntityCreated({
          entity: "competition_invite_source",
          id: source.id,
          parentEntity: "competition",
          parentId: data.championshipCompetitionId,
          attributes: {
            kind: source.kind,
            sourceCompetitionId: source.sourceCompetitionId,
            sourceGroupId: source.sourceGroupId,
          },
        })

        return { source }
      },
    )
  })

export const updateInviteSourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInviteSourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "updateInviteSourceFn",
        attributes: { sourceId: data.id },
      },
      async () => {
        // Resolve the existing row to validate cross-permission against the
        // *new* reference target if the caller is changing it.
        const existing = await getSourceById(data.id)
        if (!existing) throw new Error("Source not found")
        if (
          existing.championshipCompetitionId !== data.championshipCompetitionId
        ) {
          throw new Error("Source does not belong to this championship")
        }

        const nextKind = data.kind ?? existing.kind
        const nextComp =
          data.sourceCompetitionId !== undefined
            ? data.sourceCompetitionId
            : existing.sourceCompetitionId
        const nextGroup =
          data.sourceGroupId !== undefined
            ? data.sourceGroupId
            : existing.sourceGroupId

        await requireSourcePermissions({
          championshipCompetitionId: data.championshipCompetitionId,
          kind: nextKind,
          sourceCompetitionId: nextComp,
          sourceGroupId: nextGroup,
        })

        const source = await updateSource({
          id: data.id,
          kind: data.kind,
          sourceCompetitionId: data.sourceCompetitionId,
          sourceGroupId: data.sourceGroupId,
          directSpotsPerComp: data.directSpotsPerComp,
          globalSpots: data.globalSpots,
          divisionMappings: data.divisionMappings,
          sortOrder: data.sortOrder,
          notes: data.notes,
        })

        logEntityUpdated({
          entity: "competition_invite_source",
          id: source.id,
          attributes: {
            kind: source.kind,
            sourceCompetitionId: source.sourceCompetitionId,
            sourceGroupId: source.sourceGroupId,
          },
        })

        return { source }
      },
    )
  })

export const deleteInviteSourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteInviteSourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "deleteInviteSourceFn",
        attributes: { sourceId: data.id },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )
        await deleteSource({
          id: data.id,
          championshipCompetitionId: data.championshipCompetitionId,
        })

        logEntityDeleted({
          entity: "competition_invite_source",
          id: data.id,
          attributes: {
            championshipCompetitionId: data.championshipCompetitionId,
          },
        })

        return { ok: true as const }
      },
    )
  })

export const getChampionshipRosterFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getChampionshipRosterInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "getChampionshipRosterFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
          divisionId: data.divisionId,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )
        const { rows } = await getChampionshipRoster({
          championshipId: data.championshipCompetitionId,
          divisionId: data.divisionId,
          filters: data.filters,
        })
        return { rows }
      },
    )
  })

// ============================================================================
// Athlete-facing: resolve an invite by its plaintext token
// ============================================================================

/**
 * Public (unauthenticated) lookup of an invite by its URL-bound claim token.
 *
 * Called from the claim route loader — not a server fn a logged-in user
 * invokes via UI. The handler intentionally does *no* session check: the
 * invite's own email-lock + identity-match (run in the loader against
 * `context.session`) is the authorization boundary for this feature.
 *
 * The response is a discriminated union so the loader can switch once and
 * render the right page without a cascade of optional fields.
 */
export const getInviteByTokenFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getInviteByTokenInputSchema.parse(data))
  .handler(async ({ data }) => {
    return withRequestContext(
      {
        serverFn: "getInviteByTokenFn",
        attributes: { slug: data.slug, tokenLast4: data.token.slice(-4) },
      },
      async () => {
        const invite = await resolveInviteByToken(data.token)
        if (!invite) {
          logInfo({
            message: "[Invites] Claim token did not resolve",
            attributes: { slug: data.slug, tokenLast4: data.token.slice(-4) },
          })
          return { kind: "not_claimable" as const, reason: "not_found" as InviteClaimableError }
        }

        const db = getDb()

        // Verify the token's invite belongs to the competition in the URL.
        // Anti-typo guard: if a user mis-pastes a link they'd otherwise get
        // a confusing "right competition, wrong invite" experience.
        const [champ] = await db
          .select({
            id: competitionsTable.id,
            slug: competitionsTable.slug,
            name: competitionsTable.name,
          })
          .from(competitionsTable)
          .where(eq(competitionsTable.id, invite.championshipCompetitionId))
          .limit(1)

        if (!champ || champ.slug !== data.slug) {
          logWarning({
            message: "[Invites] Token slug mismatch",
            attributes: {
              slug: data.slug,
              tokenLast4: data.token.slice(-4),
              inviteChampionshipId: invite.championshipCompetitionId,
            },
          })
          return { kind: "not_claimable" as const, reason: "not_found" as InviteClaimableError }
        }

        try {
          assertInviteClaimable(invite)
        } catch (err) {
          if (err instanceof InviteNotClaimableError) {
            return {
              kind: "not_claimable" as const,
              reason: err.reason,
              championshipName: champ.name,
            }
          }
          throw err
        }

        const [division, account] = await Promise.all([
          db
            .select({
              id: scalingLevelsTable.id,
              label: scalingLevelsTable.label,
            })
            .from(scalingLevelsTable)
            .where(eq(scalingLevelsTable.id, invite.championshipDivisionId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
          db
            .select({ id: userTable.id })
            .from(userTable)
            .where(eq(userTable.email, normalizeInviteEmail(invite.email)))
            .limit(1)
            .then((rows) => rows[0] ?? null),
        ])

        return {
          kind: "claimable" as const,
          invite,
          championshipName: champ.name,
          championshipSlug: champ.slug,
          divisionLabel: division?.label ?? "",
          accountExistsForInviteEmail: !!account,
        }
      },
    )
  })

// ============================================================================
// Athlete-facing: decline an invite
// ============================================================================

/**
 * Decline an invite via the `/compete/$slug/claim/$token/decline` route.
 *
 * Requires the visitor to be signed in as the invited email — this is the
 * identity-match gate so a stolen link can't be used to silently decline
 * someone else's invite. We re-run the resolve + match here rather than
 * trusting the route loader, because a server fn may be called directly
 * and the client is never the source of authority.
 */
export const declineInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => declineInviteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    const sessionEmail = session?.user?.email
    if (!sessionEmail) {
      throw new Error(
        "You must be signed in to decline an invite.",
      )
    }

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "declineInviteFn",
        attributes: { slug: data.slug, tokenLast4: data.token.slice(-4) },
      },
      async () => {
        const invite = await resolveInviteByToken(data.token)
        if (!invite) {
          logInfo({
            message: "[Invites] Decline: token did not resolve",
            attributes: { tokenLast4: data.token.slice(-4) },
          })
          return { ok: false as const, reason: "not_found" as InviteClaimableError }
        }

        try {
          assertInviteClaimable(invite)
        } catch (err) {
          if (err instanceof InviteNotClaimableError) {
            return { ok: false as const, reason: err.reason }
          }
          throw err
        }

        const normalizedSessionEmail = normalizeInviteEmail(sessionEmail)
        if (normalizedSessionEmail !== normalizeInviteEmail(invite.email)) {
          logWarning({
            message: "[Invites] Decline: identity mismatch",
            attributes: {
              inviteId: invite.id,
              tokenLast4: data.token.slice(-4),
            },
          })
          throw new Error(
            "This invite is for a different account. Sign in with the invited email to decline it.",
          )
        }

        // Also verify the invite belongs to the competition in the URL.
        const [champ] = await getDb()
          .select({ slug: competitionsTable.slug })
          .from(competitionsTable)
          .where(eq(competitionsTable.id, invite.championshipCompetitionId))
          .limit(1)
        if (!champ || champ.slug !== data.slug) {
          return { ok: false as const, reason: "not_found" as InviteClaimableError }
        }

        await declineInvite({ inviteId: invite.id })
        logEntityUpdated({
          entity: "competition_invite",
          id: invite.id,
          attributes: { status: COMPETITION_INVITE_STATUS.DECLINED },
        })

        return { ok: true as const }
      },
    )
  })

// ============================================================================
// Organizer-facing: issue invites
// ============================================================================

/**
 * Render the competition invite email HTML for one invite row.
 *
 * The claim URL embeds the plaintext token — this is the *only* place the
 * plaintext escapes process memory. The decline URL is included as a
 * secondary CTA in the email body.
 */
async function renderInviteEmailHtml(params: {
  invite: CompetitionInvite
  plaintextToken: string
  championshipSlug: string
  championshipName: string
  divisionLabel: string
  organizerTeamName: string
  subject: string
  bodyText?: string
  rsvpDeadlineLabel?: string
}): Promise<string> {
  const baseUrl = getAppUrl()
  const claimUrl = `${baseUrl}/compete/${params.championshipSlug}/claim/${params.plaintextToken}`
  const declineUrl = `${claimUrl}/decline`
  const athleteName = params.invite.inviteeFirstName || params.invite.email

  return render(
    CompetitionInviteEmail({
      championshipName: params.championshipName,
      divisionLabel: params.divisionLabel,
      claimUrl,
      declineUrl,
      athleteName,
      organizerTeamName: params.organizerTeamName,
      subject: params.subject,
      bodyText: params.bodyText,
      rsvpDeadlineLabel: params.rsvpDeadlineLabel,
      sourceLabel: params.invite.sourcePlacementLabel,
    }),
  )
}

/**
 * Send invites to a set of recipients for a specific championship division.
 *
 * Composes the Phase 3 pipeline: create (or reuse) a draft round, transition
 * it to `sending`, insert or reissue rows attached to that round, render
 * per-recipient HTML, enqueue invite messages onto the shared email queue,
 * and finalize the round to `sent`. "Already active draft" bespoke rows get
 * activated via reissue and re-attached to the new round; "already active
 * with token" rows come back as skipped so the organizer can choose to
 * re-send explicitly via a re-issue flow.
 *
 * Permission: `MANAGE_COMPETITIONS` on the championship's organizing team.
 * Free divisions are rejected inside the issue helpers.
 */
export const issueInvitesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => issueInvitesInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "issueInvitesFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
          divisionId: data.championshipDivisionId,
          recipientCount: data.recipients.length,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        // Either use the supplied draft round, or create one on the fly so
        // every Phase-3 send is attributed to a real round row even when
        // the call originates from the simple "Send invites" button on the
        // roster page (which doesn't expose round metadata directly).
        let round: CompetitionInviteRound
        if (data.roundId) {
          const existing = await getRoundById(data.roundId)
          if (
            !existing ||
            existing.championshipCompetitionId !==
              data.championshipCompetitionId
          ) {
            throw new Error("Round not found")
          }
          round = existing
        } else {
          round = await createRoundDraft({
            championshipCompetitionId: data.championshipCompetitionId,
            label: data.roundLabel ?? "",
            subject: data.subject,
            rsvpDeadlineAt: data.rsvpDeadlineAt,
            bodyJson: data.bodyText
              ? JSON.stringify({ kind: "plaintext", body: data.bodyText })
              : null,
          }).catch(async (err) => {
            if (err instanceof RoundValidationError) {
              // Empty `roundLabel` falls through here when the caller
              // didn't specify one — try again with the dense fallback
              // generated from the round number.
              if (!data.roundLabel) {
                const rounds = await listRoundsForChampionship(
                  data.championshipCompetitionId,
                )
                // `rounds[0]` is the latest by `roundNumber DESC`. The
                // round we are *about* to insert lands at max + 1, which
                // is what the label needs to reflect.
                const currentMax =
                  rounds.length === 0 ? 0 : rounds[0]!.roundNumber
                const next = currentMax + 1
                return createRoundDraft({
                  championshipCompetitionId: data.championshipCompetitionId,
                  label: `Round ${next}`,
                  subject: data.subject,
                  rsvpDeadlineAt: data.rsvpDeadlineAt,
                  bodyJson: data.bodyText
                    ? JSON.stringify({
                        kind: "plaintext",
                        body: data.bodyText,
                      })
                    : null,
                })
              }
            }
            throw err
          })
        }

        // Transition the round into `sending`. Any non-recoverable error
        // below will mark it `failed` so a retry from the same row is safe.
        try {
          await beginSendingRound({ roundId: round.id })
        } catch (err) {
          if (err instanceof RoundStateConflictError) {
            throw new Error(
              `Round ${round.id} is not in a sendable state (status=${err.observedStatus ?? "missing"}); refresh and try again.`,
            )
          }
          throw err
        }

        // Everything between `beginSendingRound` and `finalizeRoundSend` runs
        // under a single failure guard so any throw — lookup miss, render
        // error, queue.send rejection — flips the round to `failed` instead
        // of leaking a `sending` row. `beginSendingRound` accepts both
        // `draft` and `failed` so the organizer can retry from the same
        // round after fixing the underlying cause.
        let issueResult: IssueInvitesResult
        let allToDispatch: Array<{
          invite: CompetitionInvite
          plaintextToken: string
        }>
        let skipped: IssueInvitesResult["alreadyActive"]
        try {
          const db = getDb()
          const [championship, division, organizingTeam] = await Promise.all([
            db
              .select({
                id: competitionsTable.id,
                slug: competitionsTable.slug,
                name: competitionsTable.name,
              })
              .from(competitionsTable)
              .where(eq(competitionsTable.id, data.championshipCompetitionId))
              .limit(1)
              .then((rows) => rows[0] ?? null),
            db
              .select({
                id: scalingLevelsTable.id,
                label: scalingLevelsTable.label,
              })
              .from(scalingLevelsTable)
              .where(eq(scalingLevelsTable.id, data.championshipDivisionId))
              .limit(1)
              .then((rows) => rows[0] ?? null),
            db
              .select({ id: teamTable.id, name: teamTable.name })
              .from(teamTable)
              .where(eq(teamTable.id, championshipTeamId))
              .limit(1)
              .then((rows) => rows[0] ?? null),
          ])

          if (!championship) throw new Error("Championship not found")
          if (!division) throw new Error("Division not found")

          const recipients: IssueInviteRecipient[] = data.recipients.map((r) => ({
            email: r.email,
            origin: r.origin,
            sourceId: r.sourceId ?? null,
            sourceCompetitionId: r.sourceCompetitionId ?? null,
            sourcePlacement: r.sourcePlacement ?? null,
            sourcePlacementLabel: r.sourcePlacementLabel ?? null,
            bespokeReason: r.bespokeReason ?? null,
            inviteeFirstName: r.inviteeFirstName ?? null,
            inviteeLastName: r.inviteeLastName ?? null,
            userId: r.userId ?? null,
          }))

          issueResult = await issueInvitesForRecipients({
            championshipCompetitionId: data.championshipCompetitionId,
            championshipDivisionId: data.championshipDivisionId,
            rsvpDeadlineAt: data.rsvpDeadlineAt,
            roundId: round.id,
            recipients,
          })

          // Activate draft bespoke rows that came back as alreadyActive+isDraft.
          // Re-attribute them to *this* round so the timeline shows them in the
          // wave that picked them up rather than the historical send.
          const activated: Array<{
            invite: CompetitionInvite
            plaintextToken: string
          }> = []
          for (const prior of issueResult.alreadyActive) {
            if (!prior.isDraft) continue
            const rotated = await reissueInvite({
              inviteId: prior.existingInviteId,
              newExpiresAt: data.rsvpDeadlineAt,
              roundId: round.id,
            })
            activated.push({
              invite: rotated.invite,
              plaintextToken: rotated.plaintextToken,
            })
          }

          allToDispatch = [...issueResult.inserted, ...activated]

          const rsvpDeadlineLabel = data.rsvpDeadlineAt.toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric", year: "numeric" },
          )

          // Render + enqueue per invite. Render is intentionally sequential
          // to keep memory bounded when a round targets hundreds of recipients.
          const queue = (env as unknown as Record<string, unknown>)
            .BROADCAST_EMAIL_QUEUE as Queue<QueueEmailMessage> | undefined

          for (const { invite, plaintextToken } of allToDispatch) {
            const bodyHtml = await renderInviteEmailHtml({
              invite,
              plaintextToken,
              championshipSlug: championship.slug,
              championshipName: championship.name,
              divisionLabel: division.label,
              organizerTeamName: organizingTeam?.name ?? "Organizer",
              subject: data.subject,
              bodyText: data.bodyText,
              rsvpDeadlineLabel,
            })

            const message: InviteEmailMessage = {
              kind: "competition-invite",
              inviteId: invite.id,
              sendAttempt: invite.sendAttempt,
              competitionId: invite.championshipCompetitionId,
              email: invite.email,
              subject: data.subject,
              bodyHtml,
            }

            if (queue) {
              await queue.send(message)
            } else {
              logInfo({
                message: "[Invites] No queue binding — logging invite email",
                attributes: { inviteId: invite.id, email: invite.email },
              })
            }

            logEntityCreated({
              entity: "competition_invite",
              id: invite.id,
              parentEntity: "competition",
              parentId: invite.championshipCompetitionId,
              attributes: {
                origin: invite.origin,
                sendAttempt: invite.sendAttempt,
                activeMarker: invite.activeMarker,
              },
            })
          }

          skipped = issueResult.alreadyActive.filter((r) => !r.isDraft)

          await finalizeRoundSend({
            roundId: round.id,
            recipientCount: allToDispatch.length,
            sentByUserId: session.userId,
          })
        } catch (err) {
          logError({
            message: "[Invites] Round send crashed; marking failed",
            error: err,
            attributes: {
              roundId: round.id,
              championshipCompetitionId: data.championshipCompetitionId,
              divisionId: data.championshipDivisionId,
              recipientCount: data.recipients.length,
            },
          })
          await markRoundFailed({ roundId: round.id }).catch((markErr) => {
            logError({
              message: "[Invites] markRoundFailed itself failed",
              error: markErr,
              attributes: { roundId: round.id },
            })
          })
          if (err instanceof FreeCompetitionNotEligibleError) {
            throw new Error(err.message)
          }
          throw err
        }

        logInfo({
          message: "[Invites] issueInvitesFn dispatched",
          attributes: {
            championshipCompetitionId: data.championshipCompetitionId,
            divisionId: data.championshipDivisionId,
            roundId: round.id,
            sent: allToDispatch.length,
            skipped: skipped.length,
          },
        })

        return {
          sentCount: allToDispatch.length,
          roundId: round.id,
          skipped,
        }
      },
    )
  })

// ============================================================================
// Organizer-facing: bespoke invite staging
// ============================================================================

export const createBespokeInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bespokeInviteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "createBespokeInviteFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const invite = await createBespokeInviteHelper({
          championshipCompetitionId: data.championshipCompetitionId,
          championshipDivisionId: data.championshipDivisionId,
          email: data.email,
          inviteeFirstName: data.inviteeFirstName,
          inviteeLastName: data.inviteeLastName,
          bespokeReason: data.bespokeReason,
        })

        logEntityCreated({
          entity: "competition_invite",
          id: invite.id,
          parentEntity: "competition",
          parentId: data.championshipCompetitionId,
          attributes: { origin: COMPETITION_INVITE_ORIGIN.BESPOKE, draft: true },
        })

        return { invite }
      },
    )
  })

export const createBespokeInvitesBulkFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bespokeBulkInviteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "createBespokeInvitesBulkFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const result = await createBespokeInvitesBulkHelper({
          championshipCompetitionId: data.championshipCompetitionId,
          championshipDivisionId: data.championshipDivisionId,
          pasteText: data.pasteText,
        })

        logInfo({
          message: "[Invites] Bulk bespoke upload processed",
          attributes: {
            championshipCompetitionId: data.championshipCompetitionId,
            created: result.created.length,
            duplicates: result.duplicates.length,
            invalid: result.invalid.length,
          },
        })

        return result
      },
    )
  })

/**
 * Organizer-facing projection of an active invite. Drops the raw
 * `claimToken` from the wire — the organizer client only needs identity
 * + classification info to render the bespoke section and overlay invite
 * state on source roster rows. The full plaintext token is fetched on
 * demand via a separate server fn when the organizer asks for a
 * copy-link.
 *
 * `hasClaimToken` lets the UI distinguish staged drafts (no token yet)
 * from already-sent invites without exposing the token itself.
 */
export interface ActiveInviteSummary {
  id: string
  email: string
  origin: CompetitionInvite["origin"]
  status: CompetitionInvite["status"]
  championshipDivisionId: string
  activeMarker: CompetitionInvite["activeMarker"]
  bespokeReason: string | null
  inviteeFirstName: string | null
  inviteeLastName: string | null
  userId: string | null
  hasClaimToken: boolean
}

/**
 * List all active invites for a championship+division. Used by the
 * organizer invites route to render the bespoke section + invite state
 * overlays on source roster rows. Phase 2: returns every active row
 * regardless of origin so the UI can classify. Returns a minimal DTO so
 * the raw token columns never reach the client.
 */
export const listActiveInvitesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    listBespokeInvitesInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ invites: ActiveInviteSummary[] }> => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "listActiveInvitesFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const db = getDb()
        const rows = await db
          .select({
            id: competitionInvitesTable.id,
            email: competitionInvitesTable.email,
            origin: competitionInvitesTable.origin,
            status: competitionInvitesTable.status,
            championshipDivisionId:
              competitionInvitesTable.championshipDivisionId,
            activeMarker: competitionInvitesTable.activeMarker,
            bespokeReason: competitionInvitesTable.bespokeReason,
            inviteeFirstName: competitionInvitesTable.inviteeFirstName,
            inviteeLastName: competitionInvitesTable.inviteeLastName,
            userId: competitionInvitesTable.userId,
            claimToken: competitionInvitesTable.claimToken,
          })
          .from(competitionInvitesTable)
          .where(
            and(
              eq(
                competitionInvitesTable.championshipCompetitionId,
                data.championshipCompetitionId,
              ),
              eq(
                competitionInvitesTable.championshipDivisionId,
                data.championshipDivisionId,
              ),
              eq(
                competitionInvitesTable.activeMarker,
                COMPETITION_INVITE_ACTIVE_MARKER,
              ),
            ),
          )

        const invites: ActiveInviteSummary[] = rows.map(
          ({ claimToken, ...rest }) => ({
            ...rest,
            hasClaimToken: claimToken !== null,
          }),
        )
        return { invites }
      },
    )
  })

// ============================================================================
// Round CRUD + listing (Phase 3)
// ============================================================================

const revokeInviteInputSchema = z.object({
  inviteId: z.string().min(1),
  championshipCompetitionId: z.string().min(1),
})

/**
 * Stage a fresh draft round for the championship. Used by the round
 * builder UI to begin a new wave that the organizer can then attach
 * recipients to before sending. Permission: `MANAGE_COMPETITIONS` on
 * the championship's organizing team.
 */
export const createRoundDraftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createRoundDraftInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "createRoundDraftFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const round = await createRoundDraft({
          championshipCompetitionId: data.championshipCompetitionId,
          label: data.label,
          subject: data.subject,
          rsvpDeadlineAt: data.rsvpDeadlineAt,
          bodyJson: data.bodyJson,
          emailTemplateId: data.emailTemplateId,
          replyTo: data.replyTo,
        })

        logEntityCreated({
          entity: "competition_invite_round",
          id: round.id,
          parentEntity: "competition",
          parentId: data.championshipCompetitionId,
          attributes: {
            roundNumber: round.roundNumber,
            status: round.status,
          },
        })

        return { round }
      },
    )
  })

/**
 * Edit a draft round's metadata. Rejects if the round has already
 * advanced past `draft` — the UI is expected to refresh and show the
 * timeline view instead.
 */
export const updateRoundDraftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateRoundDraftInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "updateRoundDraftFn",
        attributes: { roundId: data.id },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const existing = await getRoundById(data.id)
        if (
          !existing ||
          existing.championshipCompetitionId !== data.championshipCompetitionId
        ) {
          throw new Error("Round not found")
        }

        let round: CompetitionInviteRound
        try {
          round = await updateRoundDraft({
            id: data.id,
            label: data.label,
            subject: data.subject,
            rsvpDeadlineAt: data.rsvpDeadlineAt,
            bodyJson: data.bodyJson,
            emailTemplateId: data.emailTemplateId,
            replyTo: data.replyTo,
          })
        } catch (err) {
          if (err instanceof RoundStateConflictError) {
            throw new Error(
              `This round is no longer editable (status=${err.observedStatus ?? "missing"}).`,
            )
          }
          throw err
        }

        logEntityUpdated({
          entity: "competition_invite_round",
          id: round.id,
          attributes: { status: round.status },
        })

        return { round }
      },
    )
  })

/**
 * List rounds for a championship in reverse-chronological order. Drives the
 * rounds-timeline view on the organizer invites route.
 */
export const listRoundsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listRoundsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "listRoundsFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const rounds = await listRoundsForChampionship(
          data.championshipCompetitionId,
        )

        // Aggregate per-round invite counts grouped by status — this
        // powers the timeline progress bar (paid / accepted / pending /
        // declined / expired). One small COUNT-by-status query per
        // listing keeps the timeline page-load bounded.
        if (rounds.length === 0) {
          return {
            rounds: [] as Array<{
              round: typeof rounds[number]
              counts: Record<string, number>
            }>,
          }
        }

        const db = getDb()
        const roundIds = rounds.map((r) => r.id)
        const countRows = await db
          .select({
            roundId: competitionInvitesTable.roundId,
            status: competitionInvitesTable.status,
            count: sql<number>`count(*)`,
          })
          .from(competitionInvitesTable)
          .where(inArray(competitionInvitesTable.roundId, roundIds))
          .groupBy(
            competitionInvitesTable.roundId,
            competitionInvitesTable.status,
          )

        const countsByRound = new Map<string, Record<string, number>>()
        for (const row of countRows) {
          if (!row.roundId) continue
          const bucket = countsByRound.get(row.roundId) ?? {}
          bucket[row.status] = Number(row.count)
          countsByRound.set(row.roundId, bucket)
        }

        return {
          rounds: rounds.map((round) => ({
            round,
            counts: countsByRound.get(round.id) ?? {},
          })),
        }
      },
    )
  })

/**
 * Detail view for a single round — round metadata + recipients grouped by
 * origin (source vs bespoke) so the round-detail page can render two
 * panels without re-shaping the data client-side.
 */
export const getRoundDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getRoundDetailInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "getRoundDetailFn",
        attributes: { roundId: data.roundId },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const round = await getRoundById(data.roundId)
        if (
          !round ||
          round.championshipCompetitionId !== data.championshipCompetitionId
        ) {
          throw new Error("Round not found")
        }

        const db = getDb()
        const invites = await db
          .select({
            id: competitionInvitesTable.id,
            email: competitionInvitesTable.email,
            origin: competitionInvitesTable.origin,
            status: competitionInvitesTable.status,
            championshipDivisionId:
              competitionInvitesTable.championshipDivisionId,
            sourceId: competitionInvitesTable.sourceId,
            sourcePlacement: competitionInvitesTable.sourcePlacement,
            sourcePlacementLabel:
              competitionInvitesTable.sourcePlacementLabel,
            inviteeFirstName: competitionInvitesTable.inviteeFirstName,
            inviteeLastName: competitionInvitesTable.inviteeLastName,
            bespokeReason: competitionInvitesTable.bespokeReason,
            sendAttempt: competitionInvitesTable.sendAttempt,
            paidAt: competitionInvitesTable.paidAt,
            declinedAt: competitionInvitesTable.declinedAt,
            revokedAt: competitionInvitesTable.revokedAt,
          })
          .from(competitionInvitesTable)
          .where(eq(competitionInvitesTable.roundId, data.roundId))

        return { round, invites }
      },
    )
  })

/**
 * Manually revoke a single pending invite. Used by the roster row action.
 * Nulls the claim token + active marker so the link dies on the next click
 * and a re-invite (in any subsequent round) is unblocked.
 */
export const revokeInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => revokeInviteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "revokeInviteFn",
        attributes: { inviteId: data.inviteId },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )

        const db = getDb()
        const now = new Date()
        const result = await db
          .update(competitionInvitesTable)
          .set({
            status: COMPETITION_INVITE_STATUS.REVOKED,
            revokedAt: now,
            revokedByUserId: session.userId,
            claimToken: null,
            activeMarker: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(competitionInvitesTable.id, data.inviteId),
              eq(
                competitionInvitesTable.championshipCompetitionId,
                data.championshipCompetitionId,
              ),
              eq(
                competitionInvitesTable.status,
                COMPETITION_INVITE_STATUS.PENDING,
              ),
            ),
          )

        const affected = (result as unknown as { affectedRows?: number })
          .affectedRows
        // `undefined` falls into the same bucket as 0 — a driver bump
        // that drops the field shouldn't silently report success.
        if (affected == null || affected === 0) {
          throw new Error(
            "This invite is no longer pending and cannot be revoked.",
          )
        }

        logEntityUpdated({
          entity: "competition_invite",
          id: data.inviteId,
          attributes: { status: COMPETITION_INVITE_STATUS.REVOKED },
        })

        return { ok: true as const }
      },
    )
  })
