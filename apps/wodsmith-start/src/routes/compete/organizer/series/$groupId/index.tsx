import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  ChevronDown,
  Copy,
  ListPlus,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AddCompetitionsToSeriesDialog } from "@/components/add-competitions-to-series-dialog"
import type { CompetitionRevenueData } from "@/components/organizer-competitions-list"
import { OrganizerCompetitionsList } from "@/components/organizer-competitions-list"
import { SeriesRevenueSummary } from "@/components/series-competition-revenue-list"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { EditCohostPermissionsDialog } from "@/routes/compete/organizer/$competitionId/-components/edit-cohost-permissions-dialog"
import { InviteCohostDialog } from "@/routes/compete/organizer/$competitionId/-components/invite-cohost-dialog"
import type { SeriesRevenueStats } from "@/server-fns/commerce-fns"
import {
  exportSeriesRevenueCsvFn,
  getSeriesRevenueStatsFn,
} from "@/server-fns/commerce-fns"
import {
  getCompetitionGroupByIdFn,
  getOrganizerCompetitionsFn,
  updateCompetitionFn,
} from "@/server-fns/competition-fns"
import { getSeriesQuestionsFn } from "@/server-fns/registration-questions-fns"
import {
  getSeriesCohostsFn,
  removeSeriesCohostFn,
} from "@/server-fns/series-cohost-fns"
import { checkTeamHasFeatureFn } from "@/server-fns/entitlements"
import { getActiveTeamIdFn, getOrganizerTeamsFn } from "@/server-fns/team-fns"
import { FEATURES } from "@/config/features"

export const Route = createFileRoute(
  "/compete/organizer/series/$groupId/",
)({
  component: SeriesDetailPage,
  loader: async ({ params, context }) => {
    const { groupId } = params
    const { teams: organizingTeams } = await getOrganizerTeamsFn()
    const isSiteAdmin = context.session?.user?.role === "admin"

    // Fetch group details (needed for both admin and normal flow)
    const groupResult = await getCompetitionGroupByIdFn({
      data: { groupId },
    })

    if (!groupResult.group) {
      return {
        group: null,
        seriesCompetitions: [],
        allCompetitions: [],
        allGroups: [],
        seriesQuestions: [],
        seriesCohosts: { cohosts: [], pendingInvitations: [], totalCompetitions: 0 },
        deferredRevenueStats: Promise.resolve(null),
        teamId: null,
        hasCouponsEntitlement: false,
      }
    }

    if (organizingTeams.length === 0 && !isSiteAdmin) {
      return {
        group: null,
        seriesCompetitions: [],
        allCompetitions: [],
        allGroups: [],
        seriesQuestions: [],
        seriesCohosts: { cohosts: [], pendingInvitations: [], totalCompetitions: 0 },
        deferredRevenueStats: Promise.resolve(null),
        teamId: null,
        hasCouponsEntitlement: false,
      }
    }

    // Use the group's organizing team if the user has access, otherwise fall back
    const groupTeamId = groupResult.group.organizingTeamId
    let teamId: string
    if (isSiteAdmin || organizingTeams.some((t) => t.id === groupTeamId)) {
      teamId = groupTeamId
    } else {
      const activeTeamId = await getActiveTeamIdFn()
      teamId =
        organizingTeams.find((t) => t.id === activeTeamId)?.id ??
        organizingTeams[0].id
    }

    // Fetch competitions, series questions, cohosts, and entitlements in parallel
    const [competitionsResult, questionsResult, cohostsResult, hasCouponsEntitlement] =
      await Promise.all([
        getOrganizerCompetitionsFn({ data: { teamId } }),
        getSeriesQuestionsFn({ data: { groupId } }),
        getSeriesCohostsFn({
          data: { groupId, organizingTeamId: teamId },
        }).catch(() => ({
          cohosts: [],
          pendingInvitations: [],
          totalCompetitions: 0,
        })),
        checkTeamHasFeatureFn({
          data: { teamId, featureKey: FEATURES.PRODUCT_COUPONS },
        }).catch(() => false),
      ])

    const allCompetitions = competitionsResult.competitions
    const seriesCompetitions = allCompetitions.filter(
      (c) => c.groupId === groupId,
    )

    // Defer revenue stats — not needed for initial render
    const deferredRevenueStats = getSeriesRevenueStatsFn({
      data: { groupId },
    })

    return {
      group: groupResult.group,
      seriesCompetitions,
      allCompetitions,
      allGroups: [
        {
          ...groupResult.group,
          competitionCount: seriesCompetitions.length,
        },
      ],
      seriesQuestions: questionsResult.questions,
      seriesCohosts: cohostsResult,
      deferredRevenueStats,
      teamId,
      hasCouponsEntitlement,
    }
  },
})

function SeriesDetailPage() {
  const {
    group,
    seriesCompetitions,
    allCompetitions,
    allGroups,
    seriesQuestions,
    seriesCohosts,
    deferredRevenueStats,
    teamId,
    hasCouponsEntitlement,
  } = Route.useLoaderData()
  const router = useRouter()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [seriesRevenueStats, setSeriesRevenueStats] =
    useState<SeriesRevenueStats | null>(null)

  useEffect(() => {
    let cancelled = false
    deferredRevenueStats
      .then((data) => {
        if (!cancelled && data) {
          setSeriesRevenueStats(data)
        }
      })
      .catch(() => {
        // Revenue stats failed to load — section stays hidden
      })
    return () => {
      cancelled = true
    }
  }, [deferredRevenueStats])

  const revenueByCompetition = useMemo(() => {
    if (!seriesRevenueStats) return undefined
    const map = new Map<string, CompetitionRevenueData>()
    for (const comp of seriesRevenueStats.byCompetition) {
      map.set(comp.competitionId, {
        grossCents: comp.grossCents,
        organizerNetCents: comp.organizerNetCents,
        purchaseCount: comp.purchaseCount,
        byDivision: comp.byDivision,
      })
    }
    return map
  }, [seriesRevenueStats])

  const updateCompetition = useServerFn(updateCompetitionFn)
  const exportCsv = useServerFn(exportSeriesRevenueCsvFn)

  const handleQuestionsChange = () => {
    router.invalidate()
  }

  const handleRemoveFromSeries = async (competitionId: string) => {
    try {
      await updateCompetition({
        data: {
          competitionId,
          groupId: null,
        },
      })
      toast.success("Competition removed from series")
      await router.invalidate()
    } catch (error) {
      console.error("Failed to remove competition from series:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove competition from series",
      )
    }
  }

  const handleExportCsv = async () => {
    if (!group) return
    setIsExportingCsv(true)
    try {
      const csv = await exportCsv({ data: { groupId: group.id } })
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const date = new Date().toISOString().split("T")[0]
      a.download = `series-revenue-${group.slug}-${date}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to export CSV:", error)
      toast.error("Failed to export CSV")
    } finally {
      setIsExportingCsv(false)
    }
  }

  if (!teamId || !group) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
        {/* Revenue Summary */}
        {seriesRevenueStats ? (
          <SeriesRevenueSummary
            stats={seriesRevenueStats}
            onExportCsv={handleExportCsv}
            isExporting={isExportingCsv}
          />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card
                  key={i}
                  className={i === 2 ? "col-span-2 sm:col-span-1" : ""}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-28 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Series Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Series Details</CardTitle>
            <CardDescription>Information about this series</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Slug
                </div>
                <div className="text-sm font-mono mt-1">{group.slug}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Competitions
                </div>
                <div className="text-sm mt-1">
                  {seriesCompetitions.length} competition
                  {seriesCompetitions.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Series Registration Questions */}
        <RegistrationQuestionsEditor
          entityType="series"
          entityId={group.id}
          teamId={teamId}
          questions={seriesQuestions}
          onQuestionsChange={handleQuestionsChange}
        />

        {/* Series Co-Hosts */}
        <SeriesCohostsSection
          groupId={group.id}
          organizingTeamId={teamId}
          hiddenPermissions={hasCouponsEntitlement ? [] : ["coupons"]}
          cohosts={seriesCohosts.cohosts}
          pendingInvitations={seriesCohosts.pendingInvitations}
          totalCompetitions={seriesCohosts.totalCompetitions}
          competitions={seriesCompetitions.map((c) => ({ id: c.id, name: c.name }))}
        />


        {/* Competitions in Series */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-xl font-bold">Competitions in Series</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <ListPlus className="h-4 w-4 mr-2" />
                Add Existing
              </Button>
              <Button size="sm" asChild>
                <Link
                  to="/compete/organizer/new"
                  search={{ groupId: group.id }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Competition
                </Link>
              </Button>
            </div>
          </div>
          <OrganizerCompetitionsList
            competitions={seriesCompetitions}
            groups={allGroups}
            teamId={teamId}
            onRemoveFromSeries={handleRemoveFromSeries}
            revenueByCompetition={revenueByCompetition}
          />
        </div>

      {/* Add Existing Competitions Dialog */}
      <AddCompetitionsToSeriesDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        groupId={group.id}
        groupName={group.name}
        allCompetitions={allCompetitions}
        currentSeriesCompetitions={seriesCompetitions}
      />
    </div>
  )
}

// ============================================================================
// Series Co-Hosts Section
// ============================================================================

const PERMISSION_LABELS: Record<string, string> = {
  divisions: "Divisions",
  events: "Events",
  scoring: "Scoring",
  viewRegistrations: "View registrations",
  editRegistrations: "Edit registrations",
  waivers: "Waivers",
  schedule: "Schedule",
  locations: "Locations",
  volunteers: "Volunteers",
  results: "Results",
  pricing: "Pricing",
  revenue: "Revenue",
  coupons: "Coupons",
  sponsors: "Sponsors",
}

function PermissionsList({
  permissions,
}: {
  permissions: CohostMembershipMetadata
}) {
  const enabled = Object.entries(PERMISSION_LABELS).filter(
    ([key]) => permissions[key as keyof CohostMembershipMetadata],
  )
  const disabled = Object.entries(PERMISSION_LABELS).filter(
    ([key]) => !permissions[key as keyof CohostMembershipMetadata],
  )

  return (
    <div className="px-4 pb-3 pt-0">
      <div className="flex flex-wrap gap-1.5">
        {enabled.map(([key, label]) => (
          <span
            key={key}
            className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
          >
            {label}
          </span>
        ))}
        {disabled.map(([key, label]) => (
          <span
            key={key}
            className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground line-through"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function SeriesCohostsSection({
  groupId,
  organizingTeamId,
  hiddenPermissions,
  cohosts,
  pendingInvitations,
  totalCompetitions,
  competitions,
}: {
  groupId: string
  organizingTeamId: string
  hiddenPermissions: string[]
  cohosts: Array<{
    email: string
    userId: string | null
    user: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string
      avatar: string | null
    } | null
    permissions: CohostMembershipMetadata
    competitionCount: number
    membershipIds: string[]
  }>
  pendingInvitations: Array<{
    email: string
    permissions: CohostMembershipMetadata
    competitionCount: number
    firstToken: string | null
  }>
  totalCompetitions: number
  competitions: Array<{ id: string; name: string }>
}) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingCohost, setEditingCohost] = useState<{
    email: string
    name: string
    permissions: CohostMembershipMetadata
  } | null>(null)
  const router = useRouter()

  const handleRemoveCohost = async (email: string, name: string) => {
    if (!confirm(`Remove ${name} as a co-host from all competitions in this series?`))
      return
    try {
      await removeSeriesCohostFn({
        data: { email, groupId, organizingTeamId },
      })
      toast.success(`${name} removed from series`)
      router.invalidate()
    } catch {
      toast.error("Failed to remove co-host")
    }
  }

  const copyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/compete/cohost-invite/${token}`
    await navigator.clipboard.writeText(url)
    toast.success("Invite link copied")
  }

  const hasCohosts = cohosts.length > 0 || pendingInvitations.length > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Co-Hosts</CardTitle>
            {hasCohosts && (
              <CardDescription>
                {cohosts.length} active
                {pendingInvitations.length > 0
                  ? `, ${pendingInvitations.length} pending`
                  : ""}
              </CardDescription>
            )}
          </div>
          <Button
            onClick={() => setInviteOpen(true)}
            size="sm"
            variant="outline"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Invite Co-Host
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasCohosts ? (
          <div className="divide-y rounded-md border">
            {/* Active cohosts */}
            {cohosts.map((cohost) => {
              const name = cohost.user
                ? `${cohost.user.firstName ?? ""} ${cohost.user.lastName ?? ""}`.trim() ||
                  cohost.user.email
                : cohost.email
              return (
                <Collapsible key={cohost.email}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground">
                        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                        {name}
                      </CollapsibleTrigger>
                      {cohost.user && name !== cohost.user.email && (
                        <span className="text-xs text-muted-foreground">
                          {cohost.user.email}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {cohost.competitionCount} of {totalCompetitions}{" "}
                        competition
                        {totalCompetitions !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditingCohost({
                            email: cohost.email,
                            name,
                            permissions: cohost.permissions,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveCohost(cohost.email, name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <PermissionsList permissions={cohost.permissions} />
                  </CollapsibleContent>
                </Collapsible>
              )
            })}

            {/* Pending invitations */}
            {pendingInvitations.map((inv) => (
              <Collapsible key={inv.email}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                      {inv.email}
                    </CollapsibleTrigger>
                    <Badge variant="secondary" className="text-xs">
                      {inv.competitionCount} of {totalCompetitions} competition
                      {totalCompetitions !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Pending
                    </Badge>
                  </div>
                  {inv.firstToken && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(inv.firstToken!)}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy Link
                    </Button>
                  )}
                </div>
                <CollapsibleContent>
                  <PermissionsList permissions={inv.permissions} />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No co-hosts yet. Invite a partner to help manage competitions in
            this series.
          </p>
        )}
      </CardContent>

      <InviteCohostDialog
        mode="series"
        groupId={groupId}
        organizingTeamId={organizingTeamId}
        hiddenPermissions={hiddenPermissions}
        competitions={competitions}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      {editingCohost && (
        <EditCohostPermissionsDialog
          mode="series"
          open={!!editingCohost}
          onOpenChange={(open) => {
            if (!open) setEditingCohost(null)
          }}
          cohostName={editingCohost.name}
          currentPermissions={editingCohost.permissions}
          organizingTeamId={organizingTeamId}
          hiddenPermissions={hiddenPermissions}
          email={editingCohost.email}
          groupId={groupId}
        />
      )}
    </Card>
  )
}
