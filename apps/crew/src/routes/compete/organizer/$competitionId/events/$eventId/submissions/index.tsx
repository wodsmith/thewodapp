/**
 * Organizer Video Submissions List Route
 *
 * Lists all video submissions for an online competition event.
 * Allows organizers to review submissions, filter by division/status, and navigate to individual submissions.
 */

import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
} from "@tanstack/react-router"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Play,
  ThumbsDown,
  ThumbsUp,
  Video,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { z } from "zod"
import { formatTrackOrder } from "@/utils/format-track-order"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionEventFn } from "@/server-fns/competition-workouts-fns"
import { getOrganizerSubmissionsFn } from "@/server-fns/video-submission-fns"
import { cn } from "@/utils/cn"
import { isSafeUrl } from "@/utils/url"

const FLAGGED_THRESHOLD = 3

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

// Search schema for URL state
const submissionsSearchSchema = z.object({
  division: z.string().optional(),
  status: z.enum(["all", "pending", "reviewed"]).optional(),
  sort: z
    .enum([
      "newest",
      "oldest",
      "athlete",
      "division",
      "score",
      "most_downvoted",
      "most_upvoted",
    ])
    .optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/events/$eventId/submissions/",
)({
  component: SubmissionsPage,
  validateSearch: submissionsSearchSchema,
  loaderDeps: ({ search }) => ({
    division: search?.division,
    status: search?.status,
  }),
  loader: async ({ params, deps }) => {
    // First get competition to know the teamId
    const { competition } = await getCompetitionByIdFn({
      data: { competitionId: params.competitionId },
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Only allow for online competitions
    if (competition.competitionType !== "online") {
      throw new Error(
        "Video submissions are only available for online competitions",
      )
    }

    // Parallel fetch event details, divisions, and submissions
    const [eventResult, divisionsResult, submissionsResult] = await Promise.all(
      [
        getCompetitionEventFn({
          data: {
            trackWorkoutId: params.eventId,
            teamId: competition.organizingTeamId,
          },
        }),
        getCompetitionDivisionsWithCountsFn({
          data: {
            competitionId: params.competitionId,
            teamId: competition.organizingTeamId,
          },
        }),
        getOrganizerSubmissionsFn({
          data: {
            trackWorkoutId: params.eventId,
            competitionId: params.competitionId,
            divisionFilter: deps?.division,
            statusFilter: deps?.status,
          },
        }),
      ],
    )

    if (!eventResult.event) {
      throw new Error("Event not found")
    }

    return {
      event: eventResult.event,
      divisions: divisionsResult.divisions,
      submissions: submissionsResult.submissions,
      totals: submissionsResult.totals,
      currentDivisionFilter: deps?.division,
      currentStatusFilter: deps?.status || "all",
    }
  },
})

type SubmissionScore = NonNullable<
  Awaited<ReturnType<typeof getOrganizerSubmissionsFn>>["submissions"][number]["score"]
>

function ClaimedScoreCell({ score }: { score: SubmissionScore | null }) {
  if (!score?.displayScore) {
    return <span className="text-muted-foreground">—</span>
  }

  const rounds = score.roundScores ?? []
  const isMultiRound = rounds.length > 1
  const cappedRoundCount = score.cappedRoundCount ?? 0
  const totalRoundCount = score.totalRoundCount ?? rounds.length

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm">{score.displayScore}</span>
        {isMultiRound && cappedRoundCount > 0 && (
          <span
            title={
              cappedRoundCount === totalRoundCount
                ? `All ${totalRoundCount} rounds capped`
                : `${cappedRoundCount} of ${totalRoundCount} rounds capped`
            }
            className="inline-flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
          >
            {cappedRoundCount}/{totalRoundCount} cap
          </span>
        )}
      </div>
      {isMultiRound && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground font-mono">
          {rounds.map((round, i) => (
            <span key={round.roundNumber} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground/50">·</span>}
              <span className="uppercase tracking-wider text-[10px]">
                R{round.roundNumber}
              </span>
              <span
                className={cn(
                  round.status === "cap" &&
                    "text-amber-700 dark:text-amber-300",
                )}
              >
                {round.status === "cap"
                  ? `CAP (${round.displayScore ?? "—"})`
                  : (round.displayScore ?? "—")}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SubmissionsPage() {
  const {
    event,
    divisions,
    submissions,
    currentDivisionFilter,
    currentStatusFilter,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const navigate = useNavigate()
  const search = Route.useSearch()

  // Local state for sorting (client-side)
  const [sortBy, setSortBy] = useState<string>(search.sort || "newest")

  const handleDivisionChange = (value: string) => {
    navigate({
      to: "/compete/organizer/$competitionId/events/$eventId/submissions",
      params: {
        competitionId: competition.id,
        eventId: event.id,
      },
      search: (prev) => ({
        ...prev,
        division: value === "all" ? undefined : value,
      }),
      resetScroll: false,
    })
  }

  const handleStatusChange = (value: string) => {
    navigate({
      to: "/compete/organizer/$competitionId/events/$eventId/submissions",
      params: {
        competitionId: competition.id,
        eventId: event.id,
      },
      search: (prev) => ({
        ...prev,
        status: value === "all" ? undefined : (value as "pending" | "reviewed"),
      }),
      resetScroll: false,
    })
  }

  const clearFilters = () => {
    navigate({
      to: "/compete/organizer/$competitionId/events/$eventId/submissions",
      params: {
        competitionId: competition.id,
        eventId: event.id,
      },
      search: {},
      resetScroll: false,
    })
  }

  // Group submissions by registrationId (collapses multiple team videos into one row)
  type SubmissionGroup = {
    key: string
    primary: (typeof submissions)[0]
    videoCount: number
    teamSize: number
    allReviewed: boolean
    totalUpvotes: number
    totalDownvotes: number
  }

  const groups = useMemo(() => {
    const groupMap = new Map<string, SubmissionGroup>()
    for (const sub of submissions) {
      const key = sub.registrationId
      const existing = groupMap.get(key)
      if (existing) {
        existing.videoCount += 1
        existing.totalUpvotes += sub.votes.upvotes
        existing.totalDownvotes += sub.votes.downvotes
        // Keep the lowest videoIndex as primary (server orders by videoIndex ASC)
        if (sub.videoIndex < existing.primary.videoIndex) {
          existing.primary = sub
        }
      } else {
        groupMap.set(key, {
          key,
          primary: sub,
          videoCount: 1,
          teamSize: sub.division?.teamSize ?? 1,
          // Use server-computed status that considers ALL videos for this registration
          allReviewed: sub.registrationAllReviewed,
          totalUpvotes: sub.votes.upvotes,
          totalDownvotes: sub.votes.downvotes,
        })
      }
    }
    return Array.from(groupMap.values())
  }, [submissions])

  // Sort groups client-side (using primary submission's values)
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const sa = a.primary
      const sb = b.primary
      switch (sortBy) {
        case "newest":
          return (
            new Date(sb.submittedAt).getTime() -
            new Date(sa.submittedAt).getTime()
          )
        case "oldest":
          return (
            new Date(sa.submittedAt).getTime() -
            new Date(sb.submittedAt).getTime()
          )
        case "athlete": {
          const nameA = (
            sa.teamName ||
            `${sa.athlete.firstName || ""} ${sa.athlete.lastName || ""}`
          )
            .trim()
            .toLowerCase()
          const nameB = (
            sb.teamName ||
            `${sb.athlete.firstName || ""} ${sb.athlete.lastName || ""}`
          )
            .trim()
            .toLowerCase()
          return nameA.localeCompare(nameB)
        }
        case "division": {
          const divA = sa.division?.label || ""
          const divB = sb.division?.label || ""
          return divA.localeCompare(divB)
        }
        case "score": {
          if (sa.score?.value == null && sb.score?.value == null) return 0
          if (sa.score?.value == null) return 1
          if (sb.score?.value == null) return -1
          return sa.score.value - sb.score.value
        }
        case "most_downvoted":
          return b.totalDownvotes - a.totalDownvotes
        case "most_upvoted":
          return b.totalUpvotes - a.totalUpvotes
        default:
          return 0
      }
    })
  }, [groups, sortBy])

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.[0] || ""
    const last = lastName?.[0] || ""
    return (first + last).toUpperCase() || "?"
  }

  // Use group-level totals: count unique registrations, not individual videos
  const groupTotals = useMemo(() => {
    const total = groups.length
    const reviewed = groups.filter((g) => g.allReviewed).length
    return { total, reviewed, pending: total - reviewed }
  }, [groups])

  const progressPercentage =
    groupTotals.total > 0
      ? Math.round((groupTotals.reviewed / groupTotals.total) * 100)
      : 0

  const hasActiveFilters =
    currentDivisionFilter ||
    (currentStatusFilter && currentStatusFilter !== "all")

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Submissions</h1>
          <p className="text-muted-foreground">
            Event #{formatTrackOrder(event.trackOrder)} - {event.workout.name}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link
            to="/compete/organizer/$competitionId/events/$eventId"
            params={{
              competitionId: competition.id,
              eventId: event.id,
            }}
          >
            Back to Event
          </Link>
        </Button>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Review Progress</CardTitle>
          <CardDescription>
            {groupTotals.reviewed} of {groupTotals.total} submissions reviewed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={progressPercentage} className="flex-1" />
            <span className="text-sm font-medium">{progressPercentage}%</span>
          </div>
          <div className="mt-3 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span>Reviewed: {groupTotals.reviewed}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span>Pending: {groupTotals.pending}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Division filter */}
          <Select
            value={currentDivisionFilter || "all"}
            onValueChange={handleDivisionChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Divisions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map((division) => (
                <SelectItem key={division.id} value={division.id}>
                  {division.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select
            value={currentStatusFilter || "all"}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="athlete">Athlete Name</SelectItem>
              <SelectItem value="division">Division</SelectItem>
              <SelectItem value="score">Score</SelectItem>
              <SelectItem value="most_downvoted">Most Downvoted</SelectItem>
              <SelectItem value="most_upvoted">Most Upvoted</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {currentDivisionFilter && (
              <Badge
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                <span className="text-xs text-muted-foreground">Division:</span>
                <span>
                  {divisions.find((d) => d.id === currentDivisionFilter)
                    ?.label || currentDivisionFilter}
                </span>
                <button
                  type="button"
                  onClick={() => handleDivisionChange("all")}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {currentStatusFilter && currentStatusFilter !== "all" && (
              <Badge
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                <span className="text-xs text-muted-foreground">Status:</span>
                <span className="capitalize">{currentStatusFilter}</span>
                <button
                  type="button"
                  onClick={() => handleStatusChange("all")}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Submissions Table */}
      {sortedGroups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Submissions</CardTitle>
            <CardDescription>
              {hasActiveFilters
                ? "No submissions match the current filters."
                : "No video submissions have been received for this event yet."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Claimed Score</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Submitted
                    </span>
                  </TableHead>
                  <TableHead>Votes</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGroups.map((group, index) => {
                  const submission = group.primary
                  return (
                    <TableRow
                      key={group.key}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        group.totalDownvotes >= FLAGGED_THRESHOLD &&
                          "bg-red-50 dark:bg-red-950/20",
                      )}
                      onClick={() =>
                        navigate({
                          to: "/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId",
                          params: {
                            competitionId: competition.id,
                            eventId: event.id,
                            submissionId: submission.id,
                          },
                        })
                      }
                    >
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={submission.athlete.avatar ?? undefined}
                              alt={`${submission.athlete.firstName ?? ""} ${submission.athlete.lastName ?? ""}`}
                            />
                            <AvatarFallback className="text-xs">
                              {getInitials(
                                submission.athlete.firstName,
                                submission.athlete.lastName,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {submission.teamName
                                  ? submission.teamName
                                  : `${submission.athlete.firstName ?? ""} ${submission.athlete.lastName ?? ""}`}
                              </span>
                              {group.teamSize > 1 &&
                              group.videoCount < group.teamSize ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 text-xs px-1.5 py-0 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                  title={`${group.videoCount} of ${group.teamSize} partner videos submitted`}
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {group.videoCount}/{group.teamSize} videos
                                </Badge>
                              ) : group.videoCount > 1 ? (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-xs px-1.5 py-0"
                                >
                                  <Video className="h-3 w-3" />
                                  {group.videoCount} videos
                                </Badge>
                              ) : null}
                            </div>
                            {submission.teamName && (
                              <span className="text-xs text-muted-foreground">
                                {submission.athlete.firstName ?? ""}{" "}
                                {submission.athlete.lastName ?? ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {submission.division ? (
                          <Badge variant="outline">
                            {submission.division.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ClaimedScoreCell score={submission.score} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(submission.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {group.totalUpvotes}
                          </span>
                          <span
                            className={cn(
                              "flex items-center gap-0.5",
                              group.totalDownvotes >= FLAGGED_THRESHOLD
                                ? "text-red-600 dark:text-red-400 font-medium"
                                : "text-muted-foreground",
                            )}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            {group.totalDownvotes}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSafeUrl(submission.videoUrl) ? (
                          <a
                            href={submission.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Watch
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Invalid URL
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {group.allReviewed ? (
                          <Badge
                            variant="default"
                            className="gap-1 bg-green-600"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Reviewed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            to="/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId"
                            params={{
                              competitionId: competition.id,
                              eventId: event.id,
                              submissionId: submission.id,
                            }}
                          >
                            Review
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
