import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Calendar, Layers, ListPlus, Pencil, Plus, Trophy } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AddCompetitionsToSeriesDialog } from "@/components/add-competitions-to-series-dialog"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import type { CompetitionRevenueData } from "@/components/organizer-competitions-list"
import { OrganizerCompetitionsList } from "@/components/organizer-competitions-list"
import { SeriesRevenueSummary } from "@/components/series-competition-revenue-list"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { getActiveTeamIdFn, getOrganizerTeamsFn } from "@/server-fns/team-fns"

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId/",
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
        deferredRevenueStats: Promise.resolve(null),
        teamId: null,
      }
    }

    if (organizingTeams.length === 0 && !isSiteAdmin) {
      return {
        group: null,
        seriesCompetitions: [],
        allCompetitions: [],
        allGroups: [],
        seriesQuestions: [],
        deferredRevenueStats: Promise.resolve(null),
        teamId: null,
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

    // Fetch competitions and series questions in parallel
    const [competitionsResult, questionsResult] = await Promise.all([
      getOrganizerCompetitionsFn({ data: { teamId } }),
      getSeriesQuestionsFn({ data: { groupId } }),
    ])

    // Filter competitions that belong to this series
    const seriesCompetitions = competitionsResult.competitions.filter(
      (c) => c.groupId === groupId,
    )

    // Defer revenue stats — not needed for initial render
    const deferredRevenueStats = getSeriesRevenueStatsFn({
      data: { groupId },
    })

    return {
      group: groupResult.group,
      seriesCompetitions,
      allCompetitions: competitionsResult.competitions,
      allGroups: [
        {
          ...groupResult.group,
          competitionCount: seriesCompetitions.length,
        },
      ],
      seriesQuestions: questionsResult.questions,
      deferredRevenueStats,
      teamId,
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
    deferredRevenueStats,
    teamId,
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

  if (!teamId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Team Found</h1>
          <p className="text-muted-foreground mb-6">
            You need to be part of a team to view series details.
          </p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Series Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The series you're looking for doesn't exist or you don't have
            permission to view it.
          </p>
          <Button variant="outline" asChild>
            <a href="/compete/organizer/series">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Series
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="mb-4">
            <Button variant="ghost" size="sm" asChild>
              <a href="/compete/organizer/series">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Series
              </a>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{group.name}</h1>
              {group.description && (
                <p className="text-muted-foreground mt-1">
                  {group.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link
                  to="/compete/organizer/series/$groupId/divisions"
                  params={{ groupId: group.id }}
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Configure Divisions
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  to="/compete/organizer/series/$groupId/events"
                  params={{ groupId: group.id }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Event Template
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  to="/compete/organizer/series/$groupId/event-mappings"
                  params={{ groupId: group.id }}
                >
                  <ListPlus className="h-4 w-4 mr-2" />
                  Event Mappings
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  to="/compete/organizer/series/$groupId/leaderboard"
                  params={{ groupId: group.id }}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Global Leaderboard
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  to="/compete/organizer/series/$groupId/edit"
                  params={{ groupId: group.id }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Series
                </Link>
              </Button>
            </div>
          </div>
        </div>

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
            currentGroupId={group.id}
            onRemoveFromSeries={handleRemoveFromSeries}
            revenueByCompetition={revenueByCompetition}
          />
        </div>
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
