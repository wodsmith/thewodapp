/**
 * Competition Invites — organizer route shell
 *
 * Phase 1 of ADR-0011. Tabs:
 *   - Roster (placeholder until 1.7)
 *   - Sources (live)
 *   - Round History / Email Templates / Series Global (placeholders)
 *
 * Loader enforces MANAGE_COMPETITIONS on the championship's organizing
 * team via `listInviteSourcesFn`, which performs the same check
 * server-side. A redirect fires on auth failure; a thrown error bubbles
 * to the parent error boundary on permission failure.
 */
// @lat: [[competition-invites#Organizer route shell]]

import {
  createFileRoute,
  getRouteApi,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { MailPlus, PencilLine, Upload, UserPlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AddBespokeInviteeDialog } from "@/components/organizer/invites/add-bespoke-invitee-dialog"
import { BulkAddInviteesDialog } from "@/components/organizer/invites/bulk-add-invitees-dialog"
import {
  ChampionshipRosterTable,
  rosterRowKey,
} from "@/components/organizer/invites/championship-roster-table"
import { InviteSourcesList } from "@/components/organizer/invites/invite-sources-list"
import { RoundBuilderSheet } from "@/components/organizer/invites/round-builder-sheet"
import {
  RoundsTimeline,
  type RoundTimelineEntry,
} from "@/components/organizer/invites/rounds-timeline"
import {
  SendInvitesDialog,
  type SendRecipient,
} from "@/components/organizer/invites/send-invites-dialog"
import {
  indexActiveInvitesByDivisionEmail,
  pickMostRecentSentRound,
  selectAllDraftBespoke,
  selectNextOnLeaderboard,
  type SmartSelectInviteSummary,
  type SmartSelectRoundEntry,
} from "@/lib/competition-invites/smart-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
} from "@/db/schemas/competition-invites"
import { usePostHog } from "@/lib/posthog"
import type { RosterRow } from "@/server/competition-invites/roster"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  type ActiveInviteSummary,
  getChampionshipRosterFn,
  listActiveInvitesFn,
  listInviteSourcesFn,
  listRoundsFn,
  revokeInviteFn,
} from "@/server-fns/competition-invite-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/invites/",
)({
  staleTime: 10_000,
  component: InvitesPage,
  loader: async ({ params, context, parentMatchPromise }) => {
    const session = context.session
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: `/compete/organizer/${params.competitionId}/invites`,
        },
      })
    }

    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    // listInviteSourcesFn enforces MANAGE_COMPETITIONS on the championship
    // team; it throws on missing permission, which the parent route's
    // error boundary handles consistently with the rest of the dashboard.
    const [sourcesResult, divisionsResult, roundsResult] = await Promise.all([
      listInviteSourcesFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      listRoundsFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
    ])
    const {
      sources,
      competitionNamesById,
      seriesNamesById,
      seriesCompCountsById,
    } = sourcesResult

    const divisions = (divisionsResult.divisions ?? []).map(
      (d: { id: string; label: string }) => ({ id: d.id, label: d.label }),
    )

    // Load roster for the first division only; the UI can switch divisions
    // client-side in later phases. Skip the active-invites lookup entirely
    // when no division exists yet — the schema requires a non-empty
    // `championshipDivisionId` and an empty-state UI handles the no-division
    // case downstream.
    const firstDivisionId = divisions[0]?.id
    const [roster, activeInvitesResult] = await Promise.all([
      firstDivisionId
        ? getChampionshipRosterFn({
            data: {
              championshipCompetitionId: params.competitionId,
              divisionId: firstDivisionId,
            },
          })
        : Promise.resolve({ rows: [] }),
      firstDivisionId
        ? listActiveInvitesFn({
            data: {
              championshipCompetitionId: params.competitionId,
              championshipDivisionId: firstDivisionId,
            },
          })
        : Promise.resolve({ invites: [] as ActiveInviteSummary[] }),
    ])

    return {
      sources,
      competitionNamesById,
      seriesNamesById,
      seriesCompCountsById,
      divisions,
      roster,
      activeDivisionId: firstDivisionId,
      activeInvites: activeInvitesResult.invites,
      rounds: roundsResult.rounds,
    }
  },
})

function InvitesPage() {
  const {
    sources,
    competitionNamesById,
    seriesNamesById,
    seriesCompCountsById,
    divisions,
    activeDivisionId,
    roster,
    activeInvites,
    rounds,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const { competitionId } = Route.useParams()
  const router = useRouter()
  const { posthog } = usePostHog()
  const navigate = useNavigate()
  const [flagEnabled, setFlagEnabled] = useState(() =>
    posthog.isFeatureEnabled("competition-invites"),
  )
  useEffect(() => {
    const unsubscribe = posthog.onFeatureFlags(() => {
      setFlagEnabled(posthog.isFeatureEnabled("competition-invites"))
    })
    return unsubscribe
  }, [posthog])
  useEffect(() => {
    if (flagEnabled === false) {
      navigate({
        to: "/compete/organizer/$competitionId",
        replace: true,
        params: { competitionId },
      })
    }
  }, [flagEnabled, competitionId, navigate])
  const [tab, setTab] = useState("roster")
  const [addSingleOpen, setAddSingleOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [selectedRosterKeys, setSelectedRosterKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(),
  )

  const activeInviteByEmail = useMemo(() => {
    const map = new Map<string, ActiveInviteSummary>()
    for (const inv of activeInvites) {
      if (inv.activeMarker === "active") {
        map.set(`${inv.championshipDivisionId}::${inv.email.toLowerCase()}`, inv)
      }
    }
    return map
  }, [activeInvites])

  const draftBespokeInvites = useMemo(
    () =>
      activeInvites.filter(
        (inv) =>
          inv.origin === COMPETITION_INVITE_ORIGIN.BESPOKE &&
          inv.championshipDivisionId === activeDivisionId &&
          inv.activeMarker === "active" &&
          !inv.hasClaimToken,
      ),
    [activeInvites, activeDivisionId],
  )

  const isRowAlreadyInvited = (r: RosterRow) =>
    !!activeInviteByEmail.get(
      `${r.championshipDivisionId}::${(r.athleteEmail ?? "").toLowerCase()}`,
    )

  const getRevokableInviteId = (r: RosterRow): string | null => {
    const inv = activeInviteByEmail.get(
      `${r.championshipDivisionId}::${(r.athleteEmail ?? "").toLowerCase()}`,
    )
    return inv && inv.status === COMPETITION_INVITE_STATUS.PENDING
      ? inv.id
      : null
  }

  const handleRevoke = async (row: RosterRow, inviteId: string) => {
    const name = row.athleteName || row.athleteEmail || "this invite"
    if (
      !window.confirm(
        `Revoke the pending invite for ${name}? Their claim link will stop working.`,
      )
    )
      return
    try {
      await revokeInviteFn({
        data: {
          inviteId,
          championshipCompetitionId: competitionId,
        },
      })
      router.invalidate()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to revoke."
      window.alert(message)
    }
  }

  const sendableRosterRows = useMemo(
    () =>
      roster.rows.filter(
        (r: RosterRow) =>
          !!r.athleteEmail &&
          selectedRosterKeys.has(rosterRowKey(r)) &&
          !isRowAlreadyInvited(r),
      ),
    [roster.rows, selectedRosterKeys, activeInviteByEmail],
  )

  const recipients = useMemo<SendRecipient[]>(() => {
    const sourceRecipients: SendRecipient[] = sendableRosterRows.map(
      (r: RosterRow) => ({
        email: r.athleteEmail ?? "",
        origin: COMPETITION_INVITE_ORIGIN.SOURCE,
        sourceId: r.sourceId,
        sourceCompetitionId: r.sourceCompetitionId,
        sourcePlacement: r.sourcePlacement,
        sourcePlacementLabel: r.sourcePlacementLabel,
        inviteeFirstName: r.athleteName.split(" ")[0] ?? null,
        inviteeLastName: r.athleteName.split(" ").slice(1).join(" ") || null,
        userId: r.userId,
      }),
    )
    const bespokeRecipients: SendRecipient[] = draftBespokeInvites
      .filter((inv) => selectedDraftIds.has(inv.id))
      .map((inv) => ({
        email: inv.email,
        origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
        bespokeReason: inv.bespokeReason,
        inviteeFirstName: inv.inviteeFirstName,
        inviteeLastName: inv.inviteeLastName,
        userId: inv.userId,
      }))
    return [...sourceRecipients, ...bespokeRecipients]
  }, [sendableRosterRows, draftBespokeInvites, selectedDraftIds])

  const toggleRosterSelection = (key: string) => {
    setSelectedRosterKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleAllRoster = (selectAll: boolean) => {
    setSelectedRosterKeys(() => {
      if (!selectAll) return new Set()
      const next = new Set<string>()
      // Exclude rows that already have an active invite — they would be
      // dropped from `recipients` anyway, and including them in select-all
      // makes the "Send invites (N)" count silently disagree with the
      // visible checked-box count.
      for (const r of roster.rows) {
        if (r.athleteEmail && !isRowAlreadyInvited(r)) {
          next.add(rosterRowKey(r))
        }
      }
      return next
    })
  }
  const toggleDraftSelection = (id: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Smart-select inputs: cast the loader-shape `activeInvites` and
  // `rounds` to the helper-narrower types so the lib functions stay
  // decoupled from the loader/server shapes.
  const smartSelectInvites = activeInvites as SmartSelectInviteSummary[]
  const smartSelectRounds = rounds as SmartSelectRoundEntry[]
  const inviteIndexByEmail = useMemo(
    () => indexActiveInvitesByDivisionEmail(smartSelectInvites),
    [smartSelectInvites],
  )
  const mostRecentSentRoundId =
    pickMostRecentSentRound(smartSelectRounds)?.round.id ?? null
  const nextRoundNumber = (rounds[0]?.round.roundNumber ?? 0) + 1

  const handleSelectNextN = (n: number) => {
    if (!activeDivisionId) return
    const next = selectNextOnLeaderboard({
      rows: roster.rows,
      invitesByDivisionEmail: inviteIndexByEmail,
      count: n,
    })
    setSelectedRosterKeys((prev) => {
      const merged = new Set(prev)
      for (const r of next) merged.add(rosterRowKey(r as RosterRow))
      return merged
    })
  }

  const handleSelectAllDraftBespoke = () => {
    const drafts = selectAllDraftBespoke(smartSelectInvites)
    setSelectedDraftIds((prev) => {
      const merged = new Set(prev)
      for (const d of drafts) {
        if (d.championshipDivisionId === activeDivisionId) merged.add(d.id)
      }
      return merged
    })
  }

  const handleSelectReinviteNonResponders = (emails: string[]) => {
    if (emails.length === 0) return
    const emailSet = new Set(emails.map((e) => e.toLowerCase()))
    setSelectedRosterKeys((prev) => {
      const merged = new Set(prev)
      for (const r of roster.rows) {
        if (
          r.athleteEmail &&
          emailSet.has(r.athleteEmail.toLowerCase()) &&
          !isRowAlreadyInvited(r)
        ) {
          merged.add(rosterRowKey(r))
        }
      }
      return merged
    })
    // Bespoke recipients in the prior round are still tracked by their
    // invite id on this side. Match by email against the current draft
    // bespoke set so re-invite picks them up too.
    setSelectedDraftIds((prev) => {
      const merged = new Set(prev)
      for (const d of draftBespokeInvites) {
        if (emailSet.has(d.email.toLowerCase())) merged.add(d.id)
      }
      return merged
    })
  }

  if (flagEnabled === false) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invites</h1>
          <p className="text-muted-foreground">
            Define qualification sources and invite athletes to{" "}
            {competition.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setAddSingleOpen(true)}
            disabled={!activeDivisionId}
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Add invitee
          </Button>
          <Button
            variant="outline"
            onClick={() => setBulkOpen(true)}
            disabled={!activeDivisionId}
          >
            <Upload className="mr-1 h-4 w-4" />
            Bulk add
          </Button>
          <Button
            variant="outline"
            onClick={() => setBuilderOpen(true)}
            disabled={!activeDivisionId}
            title="Compose a full round with smart-select quick actions"
          >
            <PencilLine className="mr-1 h-4 w-4" />
            Compose round
          </Button>
          <Button
            onClick={() => setSendOpen(true)}
            disabled={recipients.length === 0}
          >
            <MailPlus className="mr-1 h-4 w-4" />
            Send invites ({recipients.length})
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="rounds">
            Round History
            {rounds.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {rounds.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="templates" disabled>
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="series-global" disabled>
            Series Global
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4 space-y-6">
          <ChampionshipRosterTable
            rows={roster.rows}
            selectedKeys={selectedRosterKeys}
            onToggleSelection={toggleRosterSelection}
            onToggleAll={toggleAllRoster}
            isRowAlreadyInvited={isRowAlreadyInvited}
            getRevokableInviteId={getRevokableInviteId}
            onRevoke={handleRevoke}
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Bespoke / direct invites
              </h2>
              <Badge variant="outline">
                {draftBespokeInvites.length} draft
                {draftBespokeInvites.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {draftBespokeInvites.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No draft bespoke invitees yet. Use{" "}
                <strong>Add invitee</strong> or <strong>Bulk add</strong> to
                stage rows.
              </div>
            ) : (
              <div className="rounded-md border">
                <ul className="divide-y">
                  {draftBespokeInvites.map((inv) => {
                    const name =
                      [inv.inviteeFirstName, inv.inviteeLastName]
                        .filter(Boolean)
                        .join(" ") || inv.email
                    const checked = selectedDraftIds.has(inv.id)
                    return (
                      <li
                        key={inv.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDraftSelection(inv.id)}
                          className="h-4 w-4"
                          aria-label={`Select ${inv.email}`}
                        />
                        <div className="flex-1 truncate">
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {inv.email}
                            {inv.bespokeReason
                              ? ` · ${inv.bespokeReason}`
                              : ""}
                          </div>
                        </div>
                        <Badge variant="secondary">Draft</Badge>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <InviteSourcesList
            sources={sources}
            competitionNamesById={competitionNamesById}
            seriesNamesById={seriesNamesById}
            seriesCompCountsById={seriesCompCountsById}
          />
        </TabsContent>

        <TabsContent value="rounds" className="mt-4">
          <RoundsTimeline
            competitionId={competitionId}
            rounds={rounds as RoundTimelineEntry[]}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Email templates arrive in Phase 4.
          </div>
        </TabsContent>

        <TabsContent value="series-global" className="mt-4">
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Series global integration arrives in Phase 5.
          </div>
        </TabsContent>
      </Tabs>

      {activeDivisionId ? (
        <>
          <AddBespokeInviteeDialog
            open={addSingleOpen}
            onOpenChange={setAddSingleOpen}
            championshipCompetitionId={competitionId}
            divisions={divisions}
            defaultDivisionId={activeDivisionId}
            onCreated={() => router.invalidate()}
          />
          <BulkAddInviteesDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            championshipCompetitionId={competitionId}
            divisions={divisions}
            defaultDivisionId={activeDivisionId}
            onCreated={() => router.invalidate()}
          />
          <SendInvitesDialog
            open={sendOpen}
            onOpenChange={setSendOpen}
            championshipCompetitionId={competitionId}
            championshipDivisionId={activeDivisionId}
            recipients={recipients}
            onSent={() => {
              setSelectedRosterKeys(new Set())
              setSelectedDraftIds(new Set())
              router.invalidate()
            }}
          />
          <RoundBuilderSheet
            open={builderOpen}
            onOpenChange={setBuilderOpen}
            championshipCompetitionId={competitionId}
            championshipDivisionId={activeDivisionId}
            recipients={recipients}
            mostRecentSentRoundId={mostRecentSentRoundId}
            defaultRoundNumber={nextRoundNumber}
            onSelectNextN={handleSelectNextN}
            onSelectAllDraftBespoke={handleSelectAllDraftBespoke}
            onSelectReinviteNonResponders={handleSelectReinviteNonResponders}
            onSent={() => {
              setSelectedRosterKeys(new Set())
              setSelectedDraftIds(new Set())
              router.invalidate()
            }}
          />
        </>
      ) : null}
    </div>
  )
}
