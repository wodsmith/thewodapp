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
import { Copy, MailPlus, Upload, UserPlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AddBespokeInviteeDialog } from "@/components/organizer/invites/add-bespoke-invitee-dialog"
import { BulkAddInviteesDialog } from "@/components/organizer/invites/bulk-add-invitees-dialog"
import {
  ChampionshipRosterTable,
  rosterRowKey,
} from "@/components/organizer/invites/championship-roster-table"
import { InviteSourcesList } from "@/components/organizer/invites/invite-sources-list"
import {
  SendInvitesDialog,
  type SendRecipient,
} from "@/components/organizer/invites/send-invites-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { COMPETITION_INVITE_ORIGIN } from "@/db/schemas/competition-invites"
import { usePostHog } from "@/lib/posthog"
import type { RosterRow } from "@/server/competition-invites/roster"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  type ActiveInviteSummary,
  getChampionshipRosterFn,
  listActiveInvitesFn,
  listInviteSourcesFn,
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
    const [sourcesResult, divisionsResult] = await Promise.all([
      listInviteSourcesFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
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
        map.set(
          `${inv.championshipDivisionId}::${inv.email.toLowerCase()}`,
          inv,
        )
      }
    }
    return map
  }, [activeInvites])

  const activeInviteByUserId = useMemo(() => {
    const map = new Map<string, ActiveInviteSummary>()
    for (const inv of activeInvites) {
      if (inv.activeMarker === "active" && inv.userId) {
        map.set(`${inv.championshipDivisionId}::${inv.userId}`, inv)
      }
    }
    return map
  }, [activeInvites])

  const lookupInviteForRow = (r: RosterRow): ActiveInviteSummary | null => {
    if (r.userId) {
      const byUser = activeInviteByUserId.get(
        `${r.championshipDivisionId}::${r.userId}`,
      )
      if (byUser) return byUser
    }
    if (r.athleteEmail) {
      const byEmail = activeInviteByEmail.get(
        `${r.championshipDivisionId}::${r.athleteEmail.toLowerCase()}`,
      )
      if (byEmail) return byEmail
    }
    return null
  }

  const bespokeInvites = useMemo(
    () =>
      activeInvites.filter(
        (inv) =>
          inv.origin === COMPETITION_INVITE_ORIGIN.BESPOKE &&
          inv.championshipDivisionId === activeDivisionId &&
          inv.activeMarker === "active",
      ),
    [activeInvites, activeDivisionId],
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

  const sendableRosterRows = useMemo(
    () =>
      roster.rows.filter((r: RosterRow) => {
        if (!r.athleteEmail) return false
        if (!selectedRosterKeys.has(rosterRowKey(r))) return false
        const key = `${r.championshipDivisionId}::${r.athleteEmail.toLowerCase()}`
        return !activeInviteByEmail.has(key)
      }),
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
          <TabsTrigger value="rounds" disabled>
            Round History
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
            getInviteUrlForRow={getInviteUrlForRow}
          />

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
                            checked={
                              isDraft && selectedDraftIds.has(inv.id)
                            }
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
            seriesCompCountsById={seriesCompCountsById}
          />
        </TabsContent>

        <TabsContent value="rounds" className="mt-4">
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Round history arrives in Phase 3.
          </div>
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
            championshipName={competition.name}
            divisionLabel={
              divisions.find((d) => d.id === activeDivisionId)?.label ?? ""
            }
            recipients={recipients}
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
