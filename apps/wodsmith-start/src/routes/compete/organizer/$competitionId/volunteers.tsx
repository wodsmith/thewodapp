import { useEffect, useState } from "react"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import type { JudgeAssignmentVersion } from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
  getActiveVersionFn,
  getVersionHistoryFn,
} from "@/server-fns/judge-assignment-fns"
import {
  getJudgeHeatAssignmentsFn,
  getJudgeVolunteersFn,
  getRotationsForEventFn,
} from "@/server-fns/judge-scheduling-fns"
import {
  getVolunteerAnswersFn,
  getVolunteerQuestionsFn,
} from "@/server-fns/registration-questions-fns"
import {
  canInputScoresFn,
  getCompetitionVolunteersFn,
  getDirectVolunteerInvitesFn,
  getPendingVolunteerInvitationsFn,
  getVolunteerAssignmentsFn,
} from "@/server-fns/volunteer-fns"
import { getCompetitionShiftsFn } from "@/server-fns/volunteer-shift-fns"
import { getCohostsFn } from "@/server-fns/cohost-fns"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { UserPlus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { InviteCohostDialog } from "./-components/invite-cohost-dialog"
import { InvitedVolunteersList } from "./-components/invited-volunteers-list"
import { JudgeSchedulingContainer } from "./-components/judges"
import { ShiftList } from "./-components/shifts/shift-list"
import { VolunteersList } from "./-components/volunteers-list"

// Search params schema for tab navigation and event selection
const searchParamsSchema = z.object({
  tab: z
    .enum(["roster", "shifts", "schedule", "registration-rules", "cohosts"])
    .optional()
    .default("roster"),
  event: z.string().optional(),
})

/** Per-event defaults for judge rotations */
interface EventDefaults {
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: LaneShiftPattern | null
  minHeatBuffer: number | null
}

// @lat: [[organizer-dashboard#Volunteers]]
export const Route = createFileRoute(
  "/compete/organizer/$competitionId/volunteers",
)({
  staleTime: 10_000,
  validateSearch: searchParamsSchema,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found")
    }

    const competitionTeamId = competition.competitionTeamId

    // Parallel fetch: invitations, volunteers, events, direct invites, judges, shifts, assignments, volunteer questions, volunteer answers
    const [
      invitations,
      volunteers,
      eventsResult,
      directInvites,
      judges,
      shifts,
      volunteerAssignments,
      volunteerQuestionsResult,
      volunteerAnswersResult,
    ] = await Promise.all([
      getPendingVolunteerInvitationsFn({
        data: { competitionTeamId },
      }),
      getCompetitionVolunteersFn({
        data: { competitionTeamId },
      }),
      getCompetitionWorkoutsFn({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      }),
      getDirectVolunteerInvitesFn({
        data: { competitionTeamId },
      }),
      getJudgeVolunteersFn({
        data: { competitionTeamId },
      }),
      getCompetitionShiftsFn({
        data: { competitionId: competition.id },
      }),
      getVolunteerAssignmentsFn({
        data: { competitionId: competition.id },
      }),
      getVolunteerQuestionsFn({
        data: { competitionId: competition.id },
      }),
      getVolunteerAnswersFn({
        data: {
          competitionTeamId,
          organizingTeamId: competition.organizingTeamId,
        },
      }),
    ])
    const volunteerQuestions = volunteerQuestionsResult.questions
    const { answersByInvitation, emailToInvitationId } = volunteerAnswersResult

    const events = eventsResult.workouts

    // Fetch cohosts in parallel (non-blocking — doesn't affect other tabs)
    const cohostsResult = await getCohostsFn({
      data: {
        competitionTeamId,
        organizingTeamId: competition.organizingTeamId,
      },
    })

    // For each volunteer, check if they have score access
    const volunteersWithAccess = await Promise.all(
      volunteers.map(async (volunteer) => {
        const hasScoreAccess = volunteer.user
          ? await canInputScoresFn({
              data: {
                userId: volunteer.user.id,
                competitionTeamId,
              },
            })
          : false

        return {
          ...volunteer,
          hasScoreAccess,
        }
      }),
    )

    // Get heats for all events
    const heatsResult = await getHeatsForCompetitionFn({
      data: {
        competitionId: competition.id,
        teamId: competition.organizingTeamId,
      },
    })
    const heats = heatsResult.heats

    // Get judge assignments, rotations, and version data for all events
    const [
      allAssignments,
      allRotationResults,
      allVersionHistory,
      allActiveVersions,
    ] = await Promise.all([
      Promise.all(
        events.map((event) =>
          getJudgeHeatAssignmentsFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getRotationsForEventFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getVersionHistoryFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getActiveVersionFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
    ])

    const judgeAssignments = allAssignments.flat()
    // Extract rotations from the new { rotations, eventDefaults } return type
    const rotations = allRotationResults.flatMap((result) => result.rotations)
    // Build event defaults map for each event (cast to EventDefaults for type safety)
    const eventDefaultsMap = new Map<string, EventDefaults>()
    for (const [index, event] of events.entries()) {
      const result = allRotationResults[index]
      eventDefaultsMap.set(event.id, {
        defaultHeatsCount: result?.eventDefaults?.defaultHeatsCount ?? null,
        defaultLaneShiftPattern:
          (result?.eventDefaults
            ?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
        minHeatBuffer: result?.eventDefaults?.minHeatBuffer ?? null,
      })
    }
    // Build version history map for each event
    const versionHistoryMap = new Map<string, JudgeAssignmentVersion[]>()
    for (const [index, event] of events.entries()) {
      versionHistoryMap.set(event.id, allVersionHistory[index] ?? [])
    }
    // Build active version map for each event
    const activeVersionMap = new Map<string, JudgeAssignmentVersion | null>()
    for (const [index, event] of events.entries()) {
      activeVersionMap.set(event.id, allActiveVersions[index] ?? null)
    }

    // Filter pending direct invites for conditional rendering
    const pendingDirectInvites = directInvites.filter(
      (i) => i.status === "pending",
    )

    return {
      competition,
      competitionTeamId,
      invitations,
      volunteersWithAccess,
      events,
      pendingDirectInvites,
      judges,
      heats,
      judgeAssignments,
      rotations,
      eventDefaultsMap,
      versionHistoryMap,
      activeVersionMap,
      shifts,
      volunteerAssignments,
      volunteerQuestions,
      answersByInvitation,
      emailToInvitationId,
      cohosts: cohostsResult.memberships,
      pendingCohostInvitations: cohostsResult.pendingInvitations,
    }
  },
  component: VolunteersPage,
})

function VolunteersPage() {
  const {
    competition,
    competitionTeamId,
    invitations,
    volunteersWithAccess,
    events,
    pendingDirectInvites,
    judges,
    heats,
    judgeAssignments,
    rotations,
    eventDefaultsMap,
    versionHistoryMap,
    activeVersionMap,
    shifts,
    volunteerAssignments,
    volunteerQuestions,
    answersByInvitation,
    emailToInvitationId,
    cohosts,
    pendingCohostInvitations,
  } = Route.useLoaderData()

  const { tab, event: eventFromUrl } = Route.useSearch()
  const navigate = useNavigate()

  const handleTabChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        tab: value as "roster" | "shifts" | "schedule" | "registration-rules" | "cohosts",
      }),
      replace: true,
    })
  }

  const handleEventChange = (eventId: string) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, event: eventId }),
      replace: true,
    })
  }

  // Determine selected event - from URL or first event
  // Validate eventFromUrl exists in events before using it
  const selectedEventId =
    eventFromUrl && events.some((event) => event.id === eventFromUrl)
      ? eventFromUrl
      : events[0]?.id || ""

  // Check if schedule tab should be available (in-person competitions only)
  const isInPerson = competition.competitionType === "in-person"

  // Derive effective tab - fall back to roster if schedule isn't allowed
  const effectiveTab = !isInPerson && tab === "schedule" ? "roster" : tab

  // Sync URL/state when competition type changes and schedule tab is no longer valid
  useEffect(() => {
    if (!isInPerson && tab === "schedule") {
      navigate({
        to: ".",
        search: { tab: "roster" },
        replace: true,
      })
    }
  }, [isInPerson, tab, navigate])

  const handleQuestionsChange = () => {
    // Loader will refetch on next navigation; for now this is a no-op
  }

  return (
    <Tabs
      value={effectiveTab}
      onValueChange={handleTabChange}
      className="w-full"
    >
      {/* Mobile: Select dropdown */}
      <div className="mb-6 sm:hidden">
        <Select value={effectiveTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="roster">Roster</SelectItem>
            <SelectItem value="shifts">Shifts</SelectItem>
            {isInPerson && (
              <SelectItem value="schedule">Judge Schedule</SelectItem>
            )}
            <SelectItem value="registration-rules">
              Registration Rules
            </SelectItem>
            <SelectItem value="cohosts">Co-Hosts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Tabs */}
      <TabsList className="mb-6 hidden sm:inline-flex">
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="shifts">Shifts</TabsTrigger>
        {isInPerson && (
          <TabsTrigger value="schedule">Judge Schedule</TabsTrigger>
        )}
        <TabsTrigger value="registration-rules">Registration Rules</TabsTrigger>
        <TabsTrigger value="cohosts">Co-Hosts</TabsTrigger>
      </TabsList>

      {/* Roster Tab - Volunteer Management */}
      <TabsContent value="roster" className="flex flex-col gap-8">
        {/* Invited Volunteers Section - Only show if there are pending direct invites */}
        {pendingDirectInvites.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Invited Volunteers</h2>
              <p className="text-sm text-muted-foreground">
                {pendingDirectInvites.length} pending{" "}
                {pendingDirectInvites.length === 1 ? "invite" : "invites"}
              </p>
            </div>
            <InvitedVolunteersList invites={pendingDirectInvites} />
          </section>
        )}

        {/* Volunteers Section */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Volunteers</h2>
            <p className="text-sm text-muted-foreground">
              {invitations.length + volunteersWithAccess.length} total (
              {invitations.length} application
              {invitations.length === 1 ? "" : "s"},{" "}
              {volunteersWithAccess.length} approved)
            </p>
          </div>

          <VolunteersList
            competitionId={competition.id}
            competitionSlug={competition.slug}
            competitionTeamId={competitionTeamId}
            organizingTeamId={competition.organizingTeamId}
            invitations={invitations}
            volunteers={volunteersWithAccess}
            volunteerAssignments={volunteerAssignments}
            volunteerQuestions={volunteerQuestions}
            answersByInvitation={answersByInvitation}
            emailToInvitationId={emailToInvitationId}
          />
        </section>
      </TabsContent>

      {/* Shifts Tab */}
      <TabsContent value="shifts" className="mt-6">
        <ShiftList
          competitionId={competition.id}
          competitionTeamId={competitionTeamId}
          shifts={shifts}
        />
      </TabsContent>

      {/* Schedule Tab - Judge Scheduling & Rotations (in-person only) */}
      {isInPerson && (
        <TabsContent value="schedule">
          <JudgeSchedulingContainer
            competitionId={competition.id}
            competitionSlug={competition.slug}
            organizingTeamId={competition.organizingTeamId}
            competitionType={competition.competitionType}
            events={events}
            heats={heats}
            judges={judges}
            judgeAssignments={judgeAssignments}
            rotations={rotations}
            eventDefaultsMap={eventDefaultsMap}
            versionHistoryMap={versionHistoryMap}
            activeVersionMap={activeVersionMap}
            competitionDefaultHeats={competition.defaultHeatsPerRotation ?? 4}
            competitionDefaultPattern={
              (competition.defaultLaneShiftPattern as "stay" | "shift_right") ??
              "shift_right"
            }
            selectedEventId={selectedEventId}
            onEventChange={handleEventChange}
          />
        </TabsContent>
      )}

      {/* Registration Rules Tab */}
      <TabsContent value="registration-rules">
        <RegistrationQuestionsEditor
          entityType="competition"
          entityId={competition.id}
          teamId={competition.organizingTeamId}
          questions={volunteerQuestions}
          onQuestionsChange={handleQuestionsChange}
          questionTarget="volunteer"
        />
      </TabsContent>

      {/* Co-Hosts Tab */}
      <TabsContent value="cohosts">
        <CohostsTab
          competitionId={competition.id}
          competitionTeamId={competitionTeamId}
          organizingTeamId={competition.organizingTeamId}
          cohosts={cohosts}
          pendingInvitations={pendingCohostInvitations}
        />
      </TabsContent>
    </Tabs>
  )
}

// =============================================================================
// Co-Hosts Tab Component
// =============================================================================

interface CohostsTabProps {
  competitionId: string
  competitionTeamId: string
  organizingTeamId: string
  cohosts: Array<{
    id: string
    userId: string | null
    user: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string
      avatar: string | null
    } | null
    permissions: CohostMembershipMetadata
    joinedAt: Date | null
  }>
  pendingInvitations: Array<{
    id: string
    email: string
    permissions: CohostMembershipMetadata
    createdAt: Date | string | null
  }>
}

function CohostsTab({
  competitionId,
  competitionTeamId,
  organizingTeamId,
  cohosts,
  pendingInvitations,
}: CohostsTabProps) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const router = useRouter()

  const handleRemoveCohost = async (membershipId: string, name: string) => {
    if (!confirm(`Remove ${name} as a co-host?`)) return
    try {
      const { removeCohostFn } = await import("@/server-fns/cohost-fns")
      await removeCohostFn({
        data: { membershipId, organizingTeamId },
      })
      toast.success(`${name} removed as co-host`)
      router.invalidate()
    } catch {
      toast.error("Failed to remove co-host")
    }
  }

  const handleTogglePermission = async (
    membershipId: string,
    key: keyof CohostMembershipMetadata,
    currentValue: boolean,
  ) => {
    try {
      const { updateCohostPermissionsFn } = await import("@/server-fns/cohost-fns")
      await updateCohostPermissionsFn({
        data: {
          membershipId,
          organizingTeamId,
          permissions: { [key]: !currentValue },
        },
      })
      router.invalidate()
    } catch {
      toast.error("Failed to update permission")
    }
  }

  const permissionLabel = (key: keyof CohostMembershipMetadata) => {
    switch (key) {
      case "canEditCapacity":
        return "Division & athlete capacity"
      case "canEditScoring":
        return "Scoring algorithm & tiebreaks"
      case "canEditRotation":
        return "Judge rotation defaults"
      case "canManageVolunteers":
        return "Invite & schedule volunteers"
      case "canManageEvents":
        return "Create & publish events"
      case "canManageHeats":
        return "Create heats & assign athletes"
      case "canManageResults":
        return "Enter scores & publish results"
      case "canManageRegistrations":
        return "Register athletes & transfers"
      case "canViewRevenue":
        return "View revenue & financials"
      case "canManagePricing":
        return "Set pricing & coupons"
      default:
        return key
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Co-Hosts</h2>
          <p className="text-sm text-muted-foreground">
            Invite partners to help manage this competition
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} size="sm">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite Co-Host
        </Button>
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Pending Invitations
          </h3>
          <div className="flex flex-col gap-2">
            {pendingInvitations.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <div className="mt-1 flex gap-1.5">
                      {(["canEditCapacity", "canEditScoring", "canEditRotation", "canViewRevenue", "canManagePricing", "canManageVolunteers", "canManageEvents", "canManageHeats", "canManageResults", "canManageRegistrations"] as const).map(
                        (key) =>
                          inv.permissions[key] && (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {permissionLabel(key)}
                            </Badge>
                          ),
                      )}
                    </div>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Active cohosts */}
      {cohosts.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Active Co-Hosts
          </h3>
          <div className="flex flex-col gap-2">
            {cohosts.map((cohost) => {
              const name = cohost.user
                ? `${cohost.user.firstName ?? ""} ${cohost.user.lastName ?? ""}`.trim() ||
                  cohost.user.email
                : "Unknown"
              return (
                <Card key={cohost.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <p className="font-medium">{name}</p>
                      {cohost.user && (
                        <p className="text-sm text-muted-foreground">
                          {cohost.user.email}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {(["canEditCapacity", "canEditScoring", "canEditRotation", "canViewRevenue", "canManagePricing", "canManageVolunteers", "canManageEvents", "canManageHeats", "canManageResults", "canManageRegistrations"] as const).map(
                          (key) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-1.5 text-sm"
                            >
                              <Checkbox
                                checked={cohost.permissions[key] ?? false}
                                onCheckedChange={() =>
                                  handleTogglePermission(
                                    cohost.id,
                                    key,
                                    cohost.permissions[key] ?? false,
                                  )
                                }
                              />
                              {permissionLabel(key)}
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveCohost(cohost.id, name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ) : pendingInvitations.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>No co-hosts yet</p>
          <p className="text-sm">
            Invite a partner to help manage this competition
          </p>
        </div>
      ) : null}

      <InviteCohostDialog
        competitionId={competitionId}
        competitionTeamId={competitionTeamId}
        organizingTeamId={organizingTeamId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  )
}
