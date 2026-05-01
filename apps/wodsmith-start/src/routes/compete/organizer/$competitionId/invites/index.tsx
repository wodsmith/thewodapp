/**
 * Competition Invites — organizer route shell
 *
 * Phase 1 of ADR-0011. Tabs:
 *   - Candidates (live)
 *   - Sources (live)
 *   - Sent (live)
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
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  MailPlus,
  Upload,
  UserPlus,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { AddBespokeInviteeDialog } from "@/components/organizer/invites/add-bespoke-invitee-dialog"
import { BulkAddInviteesDialog } from "@/components/organizer/invites/bulk-add-invitees-dialog"
import {
  ChampionshipRosterTable,
  rosterRowKey,
} from "@/components/organizer/invites/championship-roster-table"
import { DeleteInviteSourceDialog } from "@/components/organizer/invites/delete-invite-source-dialog"
import { EditInviteSourceDialog } from "@/components/organizer/invites/edit-invite-source-dialog"
import { InviteSourcesList } from "@/components/organizer/invites/invite-sources-list"
import {
  SendInvitesDialog,
  type SendRecipient,
} from "@/components/organizer/invites/send-invites-dialog"
import { SentInvitesByDivision } from "@/components/organizer/invites/sent-invites-by-division"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  COMPETITION_INVITE_ORIGIN,
  type CompetitionInviteSource,
} from "@/db/schemas/competition-invites"
import { usePostHog } from "@/lib/posthog"
import type { RosterRow } from "@/server/competition-invites/roster"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getCompetitionGroupsFn,
  getOrganizerCompetitionsFn,
} from "@/server-fns/competition-fns"
import {
  type ActiveInviteSummary,
  getChampionshipRosterFn,
  listActiveInvitesFn,
  listAllInvitesFn,
  listInviteSourceAllocationsFn,
  listInviteSourcesFn,
} from "@/server-fns/competition-invite-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

const inviteSearchSchema = z.object({
  /** Source competition filter (client-side). Empty string means "all". */
  source: z.string().optional(),
  /** Source division filter (client-side). Empty string means "all". */
  div: z.string().optional(),
  /** 1-indexed roster page. Omitted = page 1. `coerce` so manual deep
   *  links (`?page=2`) survive — URL params arrive as strings and a
   *  raw `z.number()` would throw at the validator. */
  page: z.coerce.number().int().positive().optional(),
})

const ROSTER_PAGE_SIZE = 50

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/invites/",
)({
  staleTime: 10_000,
  component: InvitesPage,
  validateSearch: inviteSearchSchema,
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
    // organizingTeamId scopes the source pickers — same-org-only sources
    // per ADR Open Question 6.
    const [
      sourcesResult,
      divisionsResult,
      organizerCompsResult,
      organizerGroupsResult,
      rosterResult,
      activeInvitesResult,
      allInvitesResult,
      allocationsResult,
    ] = await Promise.all([
      listInviteSourcesFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      getOrganizerCompetitionsFn({
        data: { teamId: competition.organizingTeamId },
      }),
      getCompetitionGroupsFn({
        data: { teamId: competition.organizingTeamId },
      }),
      // Single roster fetch — server fans out across all (sourceComp ×
      // division) leaderboards in parallel and returns one flat list.
      // The route component filters client-side on top of this.
      getChampionshipRosterFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      // Active invites scoped to the championship across every division —
      // the "already invited" badge means "engaged at this championship,"
      // not "invited to this specific division." The send dialog enforces
      // per-division uniqueness server-side at issue time.
      listActiveInvitesFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      // All invites (active + terminal) for the Sent audit tab. Kept as
      // a separate fetch from `listActiveInvitesFn` because the
      // Candidates tab's bespoke-draft list relies on the active filter
      // to keep terminal history out — see the rationale in
      // `listAllInvitesFn`'s docstring.
      listAllInvitesFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      // ADR-0012: per-(source, division) allocation map + summed-by-
      // division totals. The Sent tab's chip denominators read from
      // `allocationsBySourceByDivision`, and the division headline
      // denominator (`maxSpots` below) reads from
      // `divisionAllocationTotals` instead of `competition_divisions
      // .maxSpots` (registration capacity).
      listInviteSourceAllocationsFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
    ])
    const {
      sources,
      competitionNamesById,
      seriesNamesById,
      seriesCompCountsById,
    } = sourcesResult

    const { allocationsBySourceByDivision, divisionAllocationTotals } =
      allocationsResult

    // ADR-0012 Phase 2: the Sent tab's per-division headline denominator
    // switches from `competition_divisions.maxSpots` (registration
    // capacity) to `divisionAllocationTotals[divisionId]` — the resolved
    // sum of per-source allocations for that championship division. A
    // total of `0` collapses to `null` so the component renders "X
    // accepted" with no denominator (matches the existing optional-field
    // signal for "no per-division cap set").
    const championshipDivisions = (divisionsResult.divisions ?? []).map(
      (d: { id: string; label: string; maxSpots: number | null }) => {
        const total = divisionAllocationTotals[d.id] ?? 0
        return {
          id: d.id,
          label: d.label,
          maxSpots: total > 0 ? total : null,
        }
      },
    )

    // Source pickers in the EditInviteSourceDialog exclude the championship
    // itself — a competition cannot qualify athletes from its own leaderboard.
    const competitionOptions = (organizerCompsResult.competitions ?? [])
      .filter((c: { id: string }) => c.id !== params.competitionId)
      .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
    const seriesOptions = (organizerGroupsResult.groups ?? []).map(
      (g: { id: string; name: string }) => ({ id: g.id, name: g.name }),
    )

    return {
      sources,
      competitionNamesById,
      seriesNamesById,
      seriesCompCountsById,
      competitionOptions,
      seriesOptions,
      championshipDivisions,
      roster: rosterResult,
      activeInvites: activeInvitesResult.invites,
      allInvites: allInvitesResult.invites,
      allocationsBySourceByDivision,
      divisionAllocationTotals,
    }
  },
})

const ALL_FILTER = "__all__"

function ordinalSuffix(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return "th"
  switch (n % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

function InvitesPage() {
  const {
    sources,
    competitionNamesById,
    seriesNamesById,
    competitionOptions,
    seriesOptions,
    championshipDivisions,
    roster,
    activeInvites,
    allInvites,
    allocationsBySourceByDivision,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const { competitionId } = Route.useParams()
  const search = Route.useSearch()
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
  const [tab, setTab] = useState("candidates")
  const [addSingleOpen, setAddSingleOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<
    CompetitionInviteSource | undefined
  >(undefined)
  const [deletingSource, setDeletingSource] =
    useState<CompetitionInviteSource | null>(null)
  const [selectedRosterKeys, setSelectedRosterKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(),
  )

  // "Already invited" means "engaged at this championship in any
  // division" — we no longer scope the badge per championship division.
  // The send dialog enforces per-division uniqueness server-side.
  const activeInviteByEmail = useMemo(() => {
    const map = new Map<string, ActiveInviteSummary>()
    for (const inv of activeInvites) {
      if (inv.activeMarker === "active") {
        map.set(inv.email.toLowerCase(), inv)
      }
    }
    return map
  }, [activeInvites])

  const activeInviteByUserId = useMemo(() => {
    const map = new Map<string, ActiveInviteSummary>()
    for (const inv of activeInvites) {
      if (inv.activeMarker === "active" && inv.userId) {
        map.set(inv.userId, inv)
      }
    }
    return map
  }, [activeInvites])

  const lookupInviteForRow = (r: RosterRow): ActiveInviteSummary | null => {
    if (r.userId) {
      const byUser = activeInviteByUserId.get(r.userId)
      if (byUser) return byUser
    }
    if (r.athleteEmail) {
      const byEmail = activeInviteByEmail.get(r.athleteEmail.toLowerCase())
      if (byEmail) return byEmail
    }
    return null
  }

  const bespokeInvites = useMemo(
    () =>
      activeInvites.filter(
        (inv) =>
          inv.origin === COMPETITION_INVITE_ORIGIN.BESPOKE &&
          inv.activeMarker === "active",
      ),
    [activeInvites],
  )
  const draftBespokeInvites = useMemo(
    () => bespokeInvites.filter((inv) => inv.claimUrl === null),
    [bespokeInvites],
  )
  const sentBespokeCount = bespokeInvites.length - draftBespokeInvites.length

  const isRowAlreadyInvited = (r: RosterRow) => !!lookupInviteForRow(r)

  const getInviteUrlForRow = (r: RosterRow): string | null =>
    lookupInviteForRow(r)?.claimUrl ?? null

  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Invite link copied")
    } catch {
      console.warn("Failed to copy invite link")
      toast.error("Couldn't copy invite link. Please copy it manually.")
    }
  }

  // Build the unique competition + division filter universe from the
  // loaded rows. The filter selects show "All" plus every distinct
  // competition / division that appeared in the roster fetch — keeping
  // them in sync with the data is automatic this way.
  const rosterCompetitions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of roster.rows) {
      if (!seen.has(r.sourceCompetitionId)) {
        seen.set(r.sourceCompetitionId, r.sourceCompetitionName)
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [roster.rows])

  const rosterDivisions = useMemo(() => {
    // When a competition is picked, narrow division options to that
    // competition's divisions; otherwise show every division surfaced
    // anywhere in the roster.
    const seen = new Map<string, string>()
    for (const r of roster.rows) {
      if (
        search.source &&
        search.source !== ALL_FILTER &&
        r.sourceCompetitionId !== search.source
      ) {
        continue
      }
      if (!seen.has(r.sourceDivisionId)) {
        seen.set(r.sourceDivisionId, r.sourceDivisionLabel)
      }
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }))
  }, [roster.rows, search.source])

  // When the candidates table is filtered to a single source division,
  // resolve the championship division whose label matches so the Send
  // dialog can open already pointed at it. Source and championship
  // divisions are distinct entities (different ids) but typically share
  // labels (e.g. "Rx Men"); a label match is the best signal we have
  // without traversing per-source divisionMappings.
  const filteredChampionshipDivisionId = useMemo<string | undefined>(() => {
    if (!search.div || search.div === ALL_FILTER) return undefined
    const sourceLabel = rosterDivisions.find((d) => d.id === search.div)?.label
    if (!sourceLabel) return undefined
    const normalized = sourceLabel.trim().toLowerCase()
    return championshipDivisions.find(
      (d) => d.label.trim().toLowerCase() === normalized,
    )?.id
  }, [search.div, rosterDivisions, championshipDivisions])

  const filteredRosterRows = useMemo(() => {
    return roster.rows.filter((r) => {
      if (
        search.source &&
        search.source !== ALL_FILTER &&
        r.sourceCompetitionId !== search.source
      ) {
        return false
      }
      if (
        search.div &&
        search.div !== ALL_FILTER &&
        r.sourceDivisionId !== search.div
      ) {
        return false
      }
      return true
    })
  }, [roster.rows, search.source, search.div])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRosterRows.length / ROSTER_PAGE_SIZE),
  )
  // Clamp the requested page so deep links + filter narrowing don't
  // leave the user on an empty page beyond the new last page.
  const currentPage = Math.min(Math.max(1, search.page ?? 1), totalPages)
  const pagedRosterRows = useMemo(() => {
    const start = (currentPage - 1) * ROSTER_PAGE_SIZE
    return filteredRosterRows.slice(start, start + ROSTER_PAGE_SIZE)
  }, [filteredRosterRows, currentPage])

  const goToPage = (page: number) => {
    navigate({
      to: "/compete/organizer/$competitionId/invites",
      params: { competitionId },
      search: {
        source: search.source,
        div: search.div,
        page: page === 1 ? undefined : page,
      },
      replace: true,
    })
  }

  // Build recipients from the FULL roster (not just the filtered view) so
  // selections persist across filter changes — the organizer can build up
  // a cross-filter recipient list and the count + Send dialog reflect the
  // total. Dedupe by email so an athlete with placements in multiple
  // (comp, division) leaderboards only sends one invite.
  const recipients = useMemo<SendRecipient[]>(() => {
    const sourceRecipients: SendRecipient[] = []
    const seenEmail = new Set<string>()
    for (const r of roster.rows) {
      if (!r.athleteEmail) continue
      if (!selectedRosterKeys.has(rosterRowKey(r))) continue
      if (activeInviteByEmail.has(r.athleteEmail.toLowerCase())) continue
      const emailKey = r.athleteEmail.toLowerCase()
      if (seenEmail.has(emailKey)) continue
      seenEmail.add(emailKey)
      sourceRecipients.push({
        email: r.athleteEmail,
        origin: COMPETITION_INVITE_ORIGIN.SOURCE,
        sourceId: r.sourceId,
        sourceCompetitionId: r.sourceCompetitionId,
        sourcePlacement: r.sourcePlacement,
        sourcePlacementLabel:
          r.sourcePlacement != null
            ? `${r.sourcePlacement}${ordinalSuffix(r.sourcePlacement)} — ${r.sourceCompetitionName} · ${r.sourceDivisionLabel}`
            : `${r.sourceCompetitionName} · ${r.sourceDivisionLabel}`,
        inviteeFirstName: r.athleteName.split(" ")[0] ?? null,
        inviteeLastName: r.athleteName.split(" ").slice(1).join(" ") || null,
        userId: r.userId,
      })
    }
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
  }, [
    roster.rows,
    selectedRosterKeys,
    activeInviteByEmail,
    draftBespokeInvites,
    selectedDraftIds,
  ])

  // Count of source-roster selections that are currently hidden by the
  // filter — surfaces in the UI as "12 selected (8 outside current
  // filter)" so the organizer always sees their cross-filter total.
  const totalRosterSelectedCount = useMemo(() => {
    const seen = new Set<string>()
    for (const r of roster.rows) {
      if (!r.athleteEmail) continue
      if (!selectedRosterKeys.has(rosterRowKey(r))) continue
      if (activeInviteByEmail.has(r.athleteEmail.toLowerCase())) continue
      const emailKey = r.athleteEmail.toLowerCase()
      if (seen.has(emailKey)) continue
      seen.add(emailKey)
    }
    return seen.size
  }, [roster.rows, selectedRosterKeys, activeInviteByEmail])

  const visibleRosterSelectedCount = useMemo(() => {
    const seen = new Set<string>()
    for (const r of filteredRosterRows) {
      if (!r.athleteEmail) continue
      if (!selectedRosterKeys.has(rosterRowKey(r))) continue
      if (activeInviteByEmail.has(r.athleteEmail.toLowerCase())) continue
      const emailKey = r.athleteEmail.toLowerCase()
      if (seen.has(emailKey)) continue
      seen.add(emailKey)
    }
    return seen.size
  }, [filteredRosterRows, selectedRosterKeys, activeInviteByEmail])

  const hiddenSelectedCount =
    totalRosterSelectedCount - visibleRosterSelectedCount

  // ADR-0012 Phase 4: count of currently active (pending OR accepted_paid)
  // invites grouped by `(sourceId, championshipDivisionId)`. Sourced from
  // the audit projection — `activeMarker === "active"` filters the same
  // pending-or-accepted_paid window the loader already exposes. Bespoke
  // rows have null `sourceId` and are skipped (the dialog ignores bespoke
  // recipients in its allocation check anyway).
  const existingActiveCountsBySourceByDivision = useMemo<
    Record<string, Record<string, number>>
  >(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const inv of allInvites) {
      if (inv.activeMarker !== "active") continue
      if (inv.origin !== COMPETITION_INVITE_ORIGIN.SOURCE) continue
      if (!inv.sourceId) continue
      if (!map[inv.sourceId]) map[inv.sourceId] = {}
      const div = map[inv.sourceId]
      div[inv.championshipDivisionId] =
        (div[inv.championshipDivisionId] ?? 0) + 1
    }
    return map
  }, [allInvites])

  // ADR-0012 Phase 4: human-readable source label for the over-issue
  // warning. The dialog has no access to competition / series name maps
  // directly; reuse the route-level `resolveSourceLabel` helper here so
  // both the warning row and the per-recipient breakdown speak the same
  // names organizers see on the Sources tab.
  const sourceLabelsById = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const src of sources) {
      out[src.id] = resolveSourceLabel(
        src,
        competitionNamesById,
        seriesNamesById,
      )
    }
    return out
  }, [sources, competitionNamesById, seriesNamesById])

  const toggleRosterSelection = (key: string) => {
    setSelectedRosterKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleAllRoster = (selectAll: boolean) => {
    setSelectedRosterKeys((prev) => {
      // Select-all in the table header acts on the rows currently
      // visible (filtered AND on the current page) — that's what the
      // organizer can see ticked. Selections from other pages are
      // preserved when toggling on, and only the current page's keys
      // are removed when toggling off.
      const next = new Set(prev)
      for (const r of pagedRosterRows) {
        if (!r.athleteEmail || isRowAlreadyInvited(r)) continue
        if (selectAll) next.add(rosterRowKey(r))
        else next.delete(rosterRowKey(r))
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
            disabled={championshipDivisions.length === 0}
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Add invitee
          </Button>
          <Button
            variant="outline"
            onClick={() => setBulkOpen(true)}
            disabled={championshipDivisions.length === 0}
          >
            <Upload className="mr-1 h-4 w-4" />
            Bulk add
          </Button>
          <Button
            onClick={() => setSendOpen(true)}
            disabled={
              recipients.length === 0 || championshipDivisions.length === 0
            }
          >
            <MailPlus className="mr-1 h-4 w-4" />
            Send invites ({recipients.length})
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="mt-4 space-y-6">
          {rosterCompetitions.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Add a qualification source on the <strong>Sources</strong> tab to
              see athletes here.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Competition
                  </div>
                  <Select
                    value={search.source ?? ALL_FILTER}
                    onValueChange={(value) =>
                      navigate({
                        to: "/compete/organizer/$competitionId/invites",
                        params: { competitionId },
                        search: {
                          source: value === ALL_FILTER ? undefined : value,
                          // Reset division filter — it may not exist in the
                          // newly-chosen comp's division set.
                          div: undefined,
                          // Reset page — row count changes; previous page
                          // index may overshoot the new filtered list.
                          page: undefined,
                        },
                        replace: true,
                      })
                    }
                  >
                    <SelectTrigger className="min-w-[18rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER}>
                        All competitions
                      </SelectItem>
                      {rosterCompetitions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Division
                  </div>
                  <Select
                    value={search.div ?? ALL_FILTER}
                    onValueChange={(value) =>
                      navigate({
                        to: "/compete/organizer/$competitionId/invites",
                        params: { competitionId },
                        search: {
                          source: search.source,
                          div: value === ALL_FILTER ? undefined : value,
                          page: undefined,
                        },
                        replace: true,
                      })
                    }
                    disabled={rosterDivisions.length === 0}
                  >
                    <SelectTrigger className="min-w-[14rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER}>All divisions</SelectItem>
                      {rosterDivisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Showing{" "}
                    {filteredRosterRows.length === 0
                      ? 0
                      : (currentPage - 1) * ROSTER_PAGE_SIZE + 1}
                    –
                    {Math.min(
                      currentPage * ROSTER_PAGE_SIZE,
                      filteredRosterRows.length,
                    )}{" "}
                    of {filteredRosterRows.length} athletes
                    {filteredRosterRows.length !== roster.rows.length ? (
                      <span className="ml-1">
                        (filtered from {roster.rows.length})
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
              {totalRosterSelectedCount > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <div>
                    <strong>{totalRosterSelectedCount}</strong> athlete
                    {totalRosterSelectedCount === 1 ? "" : "s"} selected
                    {hiddenSelectedCount > 0 ? (
                      <span className="ml-1 text-muted-foreground">
                        ({hiddenSelectedCount} outside current filter)
                      </span>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRosterKeys(new Set())}
                  >
                    Clear selection
                  </Button>
                </div>
              ) : null}
              <ChampionshipRosterTable
                rows={pagedRosterRows}
                selectedKeys={selectedRosterKeys}
                onToggleSelection={toggleRosterSelection}
                onToggleAll={toggleAllRoster}
                isRowAlreadyInvited={isRowAlreadyInvited}
                getInviteUrlForRow={getInviteUrlForRow}
                allocationsBySourceByDivision={allocationsBySourceByDivision}
                championshipDivisions={championshipDivisions}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => goToPage(currentPage - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          <section className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold tracking-tight">
                Bespoke / direct invites
              </h2>
              <span className="text-xs text-muted-foreground">
                {draftBespokeInvites.length} draft
                {draftBespokeInvites.length === 1 ? "" : "s"}
                {sentBespokeCount > 0 ? ` · ${sentBespokeCount} sent` : ""}
              </span>
            </div>
            {bespokeInvites.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                No bespoke invitees yet. Use <strong>Add invitee</strong> or{" "}
                <strong>Bulk add</strong> to stage rows.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            draftBespokeInvites.length > 0 &&
                            draftBespokeInvites.every((inv) =>
                              selectedDraftIds.has(inv.id),
                            )
                          }
                          disabled={draftBespokeInvites.length === 0}
                          onCheckedChange={(v) => {
                            setSelectedDraftIds(
                              v === true
                                ? new Set(
                                    draftBespokeInvites.map((inv) => inv.id),
                                  )
                                : new Set(),
                            )
                          }}
                          aria-label="Select all draft invitees"
                        />
                      </TableHead>
                      <TableHead className="w-20 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Rank
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Athlete
                      </TableHead>
                      <TableHead className="w-48 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Qualified via
                      </TableHead>
                      <TableHead className="w-32 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="w-16 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bespokeInvites.map((inv) => {
                      const name =
                        [inv.inviteeFirstName, inv.inviteeLastName]
                          .filter(Boolean)
                          .join(" ") || inv.email
                      const initial = name.charAt(0).toUpperCase()
                      const isDraft = inv.claimUrl === null
                      const statusLabel =
                        inv.status === "accepted_paid"
                          ? "Accepted"
                          : inv.status === "declined"
                            ? "Declined"
                            : inv.status === "expired"
                              ? "Expired"
                              : inv.status === "revoked"
                                ? "Revoked"
                                : isDraft
                                  ? "Not invited"
                                  : "Invited"
                      const statusBadgeClass =
                        inv.status === "accepted_paid"
                          ? "border-transparent bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
                          : inv.status === "declined"
                            ? "border-transparent bg-rose-500/15 text-rose-400 hover:bg-rose-500/20"
                            : inv.status === "expired" ||
                                inv.status === "revoked"
                              ? "border-transparent bg-muted text-muted-foreground"
                              : isDraft
                                ? "border-dashed text-muted-foreground"
                                : "border-transparent bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Checkbox
                              checked={isDraft && selectedDraftIds.has(inv.id)}
                              disabled={!isDraft}
                              onCheckedChange={() =>
                                isDraft && toggleDraftSelection(inv.id)
                              }
                              aria-label={
                                isDraft
                                  ? `Select ${inv.email}`
                                  : `${inv.email} already sent`
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <span className="tabular-nums font-medium">—</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                {initial}
                              </div>
                              <div className="flex flex-col leading-tight">
                                <span>{name}</span>
                                {name !== inv.email ? (
                                  <span className="text-xs text-muted-foreground">
                                    {inv.email}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {inv.bespokeReason ?? "Direct invite"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isDraft ? "outline" : "default"}
                              className={statusBadgeClass}
                            >
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {inv.claimUrl !== null ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Copy invite link"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  inv.claimUrl && copyInviteLink(inv.claimUrl)
                                }
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <InviteSourcesList
            sources={sources}
            competitionNamesById={competitionNamesById}
            seriesNamesById={seriesNamesById}
            allocationsBySourceByDivision={allocationsBySourceByDivision}
            championshipDivisions={championshipDivisions}
            onAdd={() => {
              setEditingSource(undefined)
              setSourceDialogOpen(true)
            }}
            onEdit={(source) =>
              navigate({
                to: "/compete/organizer/$competitionId/invites/sources/$sourceId",
                params: { competitionId, sourceId: source.id },
              })
            }
            onDelete={(source) => setDeletingSource(source)}
          />
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <SentInvitesByDivision
            invites={allInvites}
            divisions={championshipDivisions}
            sources={sources}
            competitionNamesById={competitionNamesById}
            seriesNamesById={seriesNamesById}
            allocationsBySourceByDivision={allocationsBySourceByDivision}
          />
        </TabsContent>

      </Tabs>

      {championshipDivisions[0] ? (
        <>
          <AddBespokeInviteeDialog
            open={addSingleOpen}
            onOpenChange={setAddSingleOpen}
            championshipCompetitionId={competitionId}
            divisions={championshipDivisions}
            defaultDivisionId={championshipDivisions[0].id}
            onCreated={() => router.invalidate()}
          />
          <BulkAddInviteesDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            championshipCompetitionId={competitionId}
            divisions={championshipDivisions}
            defaultDivisionId={championshipDivisions[0].id}
            onCreated={() => router.invalidate()}
          />
          <SendInvitesDialog
            open={sendOpen}
            onOpenChange={setSendOpen}
            championshipCompetitionId={competitionId}
            championshipDivisions={championshipDivisions}
            defaultDivisionId={filteredChampionshipDivisionId}
            championshipName={competition.name}
            recipients={recipients}
            allocationsBySourceByDivision={allocationsBySourceByDivision}
            existingActiveCountsBySourceByDivision={
              existingActiveCountsBySourceByDivision
            }
            sourceLabelsById={sourceLabelsById}
            onSent={() => {
              setSelectedRosterKeys(new Set())
              setSelectedDraftIds(new Set())
              router.invalidate()
            }}
          />
        </>
      ) : null}

      <EditInviteSourceDialog
        open={sourceDialogOpen}
        onOpenChange={setSourceDialogOpen}
        championshipCompetitionId={competitionId}
        source={editingSource}
        competitionOptions={competitionOptions}
        seriesOptions={seriesOptions}
        onSaved={() => router.invalidate()}
      />
      <DeleteInviteSourceDialog
        open={deletingSource !== null}
        onOpenChange={(next) => {
          if (!next) setDeletingSource(null)
        }}
        championshipCompetitionId={competitionId}
        source={deletingSource}
        sourceLabel={resolveSourceLabel(
          deletingSource,
          competitionNamesById,
          seriesNamesById,
        )}
        onDeleted={() => router.invalidate()}
      />
    </div>
  )
}

function resolveSourceLabel(
  source: CompetitionInviteSource | null,
  competitionNamesById: Record<string, string>,
  seriesNamesById: Record<string, string>,
): string {
  if (!source) return ""
  if (source.kind === "series") {
    return source.sourceGroupId
      ? (seriesNamesById[source.sourceGroupId] ?? "Unknown series")
      : "Unknown series"
  }
  return source.sourceCompetitionId
    ? (competitionNamesById[source.sourceCompetitionId] ??
        "Unknown competition")
    : "Unknown competition"
}
