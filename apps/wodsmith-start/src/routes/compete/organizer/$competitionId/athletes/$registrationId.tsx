/**
 * Organizer Athlete Detail Page
 *
 * Single-registration editor: captain + teammate profile edits, team name,
 * division transfer, registration answers, waivers (read-only), and the
 * scores / video submissions surface.
 */
// @lat: [[organizer-dashboard#Registrations (Athletes)]]

import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Shuffle, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import { getOrganizerAthleteDetailFn } from "@/server-fns/organizer-athlete-fns"
import { removeRegistrationFn } from "@/server-fns/registration-fns"
import { TransferDivisionDialog } from "../-components/transfer-division-dialog"
import { AnswersSection } from "./-components/answers-section"
import { AthleteProfileCard } from "./-components/athlete-profile-card"
import { RegistrationInfoCard } from "./-components/registration-info-card"
import { ScoresSection } from "./-components/scores-section"
import { TeamMembersSection } from "./-components/team-members-section"
import { VideoSubmissionsSection } from "./-components/video-submissions-section"
import { WaiversSection } from "./-components/waivers-section"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/athletes/$registrationId",
)({
  staleTime: 10_000,
  component: AthleteDetailPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!
    const [detail, divisionsResult] = await Promise.all([
      getOrganizerAthleteDetailFn({
        data: {
          registrationId: params.registrationId,
          competitionId: params.competitionId,
        },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
    ])
    return { detail, divisions: divisionsResult.divisions }
  },
})

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—"
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function AthleteDetailPage() {
  const { competition } = parentRoute.useLoaderData()
  const { detail, divisions } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const removeRegistration = useServerFn(removeRegistrationFn)

  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const isTeamDivision = (detail.division?.teamSize ?? 1) > 1
  const captainName = [detail.captain?.firstName, detail.captain?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  const displayTitle =
    (isTeamDivision && detail.registration.teamName) ||
    captainName ||
    detail.captain?.email ||
    "Registration"

  const isRemoved = detail.registration.status === "removed"

  const handleRemoveRegistration = async () => {
    setIsRemoving(true)
    try {
      await removeRegistration({
        data: {
          registrationId: detail.registration.id,
          competitionId: competition.id,
        },
      })
      toast.success("Registration removed")
      setShowRemoveDialog(false)
      navigate({
        to: "/compete/organizer/$competitionId/athletes",
        params: { competitionId: competition.id },
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove registration",
      )
    } finally {
      setIsRemoving(false)
    }
  }

  // Captain + teammate memberships (for rendering profile cards)
  const members: Array<{
    userId: string
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
    isCaptain: boolean
    isActive: boolean
    joinedAt: Date | null
  }> = []

  if (detail.captain) {
    members.push({
      userId: detail.captain.id,
      firstName: detail.captain.firstName,
      lastName: detail.captain.lastName,
      email: detail.captain.email,
      avatar: detail.captain.avatar,
      isCaptain: true,
      isActive: true,
      joinedAt: null,
    })
  }

  if (detail.athleteTeam?.memberships) {
    for (const m of detail.athleteTeam.memberships) {
      if (m.userId === detail.registration.userId) continue
      if (!m.user) continue
      members.push({
        userId: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        avatar: m.user.avatar,
        isCaptain: false,
        isActive: m.isActive,
        joinedAt: m.joinedAt,
      })
    }
  }

  // Parse affiliates from metadata
  let metadata: Record<string, unknown> | null = null
  if (detail.registration.metadata) {
    if (typeof detail.registration.metadata === "string") {
      try {
        metadata = JSON.parse(detail.registration.metadata)
      } catch {
        // ignore
      }
    } else {
      metadata = detail.registration.metadata as Record<string, unknown>
    }
  }
  const metadataAffiliates = metadata?.affiliates as
    | Record<string, string | null>
    | undefined

  return (
    <>
      <div className="flex flex-col gap-8 pb-12">
        {/* Page header */}
        <div className="flex flex-col gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link
                to="/compete/organizer/$competitionId/athletes"
                params={{ competitionId: competition.id }}
                search={{ tab: "athletes" }}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Athletes
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight truncate">
                {displayTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {detail.division && (
                  <Badge variant="outline">{detail.division.label}</Badge>
                )}
                {isRemoved ? (
                  <Badge variant="destructive">Removed</Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                  >
                    Active
                  </Badge>
                )}
                {isTeamDivision && captainName && (
                  <span className="text-sm text-muted-foreground">
                    Captain: {captainName}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowTransferDialog(true)}
                disabled={isRemoved}
              >
                <Shuffle className="h-4 w-4 mr-2" />
                Change Division
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRemoveDialog(true)}
                disabled={isRemoved}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Registration
              </Button>
            </div>
          </div>
        </div>

        {/* Registration Info */}
        <RegistrationInfoCard
          registration={detail.registration}
          division={detail.division}
          competitionId={competition.id}
          isTeamDivision={isTeamDivision}
          commercePurchase={detail.commercePurchase}
          formatDate={formatDate}
          onChangeDivisionClick={() => setShowTransferDialog(true)}
        />

        {/* Members profile cards */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {isTeamDivision ? "Captain & Athletes" : "Athlete Profile"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Editing a name or email updates that user's account profile
              everywhere.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {members.map((m) => (
              <AthleteProfileCard
                key={m.userId}
                member={m}
                affiliateName={metadataAffiliates?.[m.userId] ?? null}
                registrationId={detail.registration.id}
                competitionId={competition.id}
              />
            ))}
          </div>
        </div>

        {/* Team Members Section */}
        {isTeamDivision && detail.athleteTeam && (
          <TeamMembersSection
            registrationId={detail.registration.id}
            competitionId={competition.id}
            captainUserId={detail.registration.userId}
            teamSize={detail.division?.teamSize ?? 1}
            members={members}
            pendingInvites={detail.pendingInvites}
            formatDate={formatDate}
          />
        )}

        {/* Answers Section */}
        {detail.questions.length > 0 && (
          <AnswersSection
            registrationId={detail.registration.id}
            competitionId={competition.id}
            questions={detail.questions}
            answers={detail.answers}
            members={members}
            isTeamDivision={isTeamDivision}
          />
        )}

        {/* Waivers Section */}
        {detail.waivers.length > 0 && (
          <WaiversSection
            waivers={detail.waivers}
            waiverSignatures={detail.waiverSignatures}
            members={members}
            formatDate={formatDate}
          />
        )}

        {/* Scores / Submissions */}
        {competition.competitionType === "online" ? (
          <VideoSubmissionsSection
            registrationId={detail.registration.id}
            competitionId={competition.id}
            events={detail.events}
            videoSubmissions={detail.videoSubmissions}
            scores={detail.scores}
            members={members}
            teamSize={detail.division?.teamSize ?? 1}
            captainUserId={detail.registration.userId}
            formatDateTime={formatDateTime}
          />
        ) : (
          <ScoresSection
            registrationId={detail.registration.id}
            competitionId={competition.id}
            organizingTeamId={competition.organizingTeamId}
            divisionId={detail.registration.divisionId}
            events={detail.events}
            scores={detail.scores}
            members={members}
          />
        )}
      </div>

      {/* Remove dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the registration for{" "}
              <strong>{displayTitle}</strong>? This removes them from the
              competition, deletes their heat assignments and scores. You'll be
              redirected back to the athletes list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveRegistration}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove Registration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer division dialog */}
      {showTransferDialog && (
        <TransferDivisionDialog
          open={showTransferDialog}
          onOpenChange={(open) => {
            setShowTransferDialog(open)
            if (!open) router.invalidate()
          }}
          registration={{
            id: detail.registration.id,
            athleteName: displayTitle,
            divisionId: detail.registration.divisionId,
            divisionLabel: detail.division?.label ?? null,
            teamSize: detail.division?.teamSize ?? 1,
          }}
          divisions={divisions}
          competitionId={competition.id}
          registeredDivisionIds={[]}
        />
      )}
    </>
  )
}
