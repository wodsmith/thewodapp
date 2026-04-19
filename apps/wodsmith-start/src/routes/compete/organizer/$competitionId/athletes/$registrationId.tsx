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
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CreditCard,
  Link2,
  Mail,
  Pencil,
  Send,
  Shuffle,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { COMMERCE_PAYMENT_STATUS } from "@/db/schemas/commerce"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getOrganizerAthleteDetailFn,
  removeTeammateFromRegistrationFn,
  updateRegistrationTeamNameFn,
} from "@/server-fns/organizer-athlete-fns"
import {
  cancelPurchaseTransferFn,
  getPendingTransfersForCompetitionFn,
} from "@/server-fns/purchase-transfer-fns"
import { removeRegistrationFn } from "@/server-fns/registration-fns"
import { TransferDivisionDialog } from "../-components/transfer-division-dialog"
import { TransferRegistrationDialog } from "../-components/transfer-registration-dialog"
import { AddTeammateDialog } from "./-components/add-teammate-dialog"
import { AnswersSection } from "./-components/answers-section"
import { AthleteProfileCard } from "./-components/athlete-profile-card"
import { RosterSlotCard } from "./-components/roster-slot-card"
import { ScoresSection } from "./-components/scores-section"
import {
  type AthleteDetailMember,
  memberDisplayName,
  memberInitials,
} from "./-components/types"
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
    const [detail, divisionsResult, pendingTransfers] = await Promise.all([
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
      getPendingTransfersForCompetitionFn({
        data: { competitionId: params.competitionId },
      }),
    ])
    return {
      detail,
      divisions: divisionsResult.divisions,
      pendingTransfers,
    }
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

function SectionHeading({
  index,
  title,
  description,
  action,
}: {
  index: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
        <span className="tabular-nums">{index}</span>
        <span className="h-px w-8 bg-border" />
      </div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </div>
  )
}

function MetaField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}

function AthleteDetailPage() {
  const { competition } = parentRoute.useLoaderData()
  const { detail, divisions, pendingTransfers } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const removeRegistration = useServerFn(removeRegistrationFn)
  const updateTeamName = useServerFn(updateRegistrationTeamNameFn)
  const removeTeammate = useServerFn(removeTeammateFromRegistrationFn)
  const cancelPurchaseTransfer = useServerFn(cancelPurchaseTransferFn)

  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showTransferRegistrationDialog, setShowTransferRegistrationDialog] =
    useState(false)
  const [isCancellingTransfer, setIsCancellingTransfer] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [editingTeamName, setEditingTeamName] = useState(false)
  const [teamNameInput, setTeamNameInput] = useState(
    detail.registration.teamName ?? "",
  )
  const [isSavingTeamName, setIsSavingTeamName] = useState(false)
  const [showAddTeammate, setShowAddTeammate] = useState(false)
  const [removeTeammateTarget, setRemoveTeammateTarget] =
    useState<AthleteDetailMember | null>(null)
  const [isRemovingTeammate, setIsRemovingTeammate] = useState(false)

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

  // Active purchase transfer for this registration, if any. The loader
  // returns every INITIATED transfer in the competition — match on the
  // registration's commercePurchaseId.
  const activeTransfer = detail.registration.commercePurchaseId
    ? (pendingTransfers.find(
        (t) => t.purchaseId === detail.registration.commercePurchaseId,
      ) ?? null)
    : null
  const canTransferRegistration =
    !!detail.registration.commercePurchaseId && !isRemoved

  const isPaid =
    detail.registration.paymentStatus === COMMERCE_PAYMENT_STATUS.PAID ||
    detail.registration.paymentStatus ===
      COMMERCE_PAYMENT_STATUS.PAID_OFFLINE ||
    detail.registration.paymentStatus === COMMERCE_PAYMENT_STATUS.COMP ||
    detail.registration.paymentStatus === COMMERCE_PAYMENT_STATUS.FREE
  const paidAmount =
    detail.commercePurchase?.totalCents != null
      ? `$${(detail.commercePurchase.totalCents / 100).toFixed(2)}`
      : null

  const handleRemoveRegistration = async (event: React.MouseEvent) => {
    // Keep the AlertDialog open while the async request is in-flight — by
    // default AlertDialogAction closes the dialog on click.
    event.preventDefault()
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

  const handleRemoveTeammate = async () => {
    if (!removeTeammateTarget) return
    setIsRemovingTeammate(true)
    try {
      await removeTeammate({
        data: {
          registrationId: detail.registration.id,
          competitionId: competition.id,
          userId: removeTeammateTarget.userId,
        },
      })
      toast.success("Teammate removed")
      setRemoveTeammateTarget(null)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove teammate",
      )
    } finally {
      setIsRemovingTeammate(false)
    }
  }

  const handleCancelTransfer = async () => {
    if (!activeTransfer) return
    setIsCancellingTransfer(true)
    try {
      await cancelPurchaseTransfer({ data: { transferId: activeTransfer.id } })
      toast.success("Transfer cancelled")
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel transfer",
      )
    } finally {
      setIsCancellingTransfer(false)
    }
  }

  const handleSaveTeamName = async () => {
    const trimmed = teamNameInput.trim()
    if (!trimmed) {
      toast.error("Team name cannot be empty")
      return
    }
    setIsSavingTeamName(true)
    try {
      await updateTeamName({
        data: {
          registrationId: detail.registration.id,
          competitionId: competition.id,
          teamName: trimmed,
        },
      })
      toast.success("Team name updated")
      setEditingTeamName(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update team name",
      )
    } finally {
      setIsSavingTeamName(false)
    }
  }

  // Captain + teammate memberships (for rendering profile cards)
  const members: AthleteDetailMember[] = []

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
      isPlaceholder: detail.captain.isPlaceholder,
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
        isPlaceholder: m.user.isPlaceholder,
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

  const visibleAvatars = members.slice(0, 3)
  const extraAvatarCount = Math.max(members.length - visibleAvatars.length, 0)

  const hasRegistrationDetails =
    detail.questions.length > 0 || detail.waivers.length > 0
  const sectionIndex = {
    roster: "01",
    registration: hasRegistrationDetails ? "02" : null,
    scores: hasRegistrationDetails ? "03" : "02",
  }

  return (
    <>
      <div className="flex flex-col gap-12 pb-16">
        {/* Back link */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link
              to="/compete/organizer/$competitionId/athletes"
              params={{ competitionId: competition.id }}
              search={{ tab: "athletes" }}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              All athletes
            </Link>
          </Button>
        </div>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-2xl border bg-card">
          {/* Atmospheric tint */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.04),transparent_60%)]"
          />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-5 min-w-0 flex-1">
                <div className="flex shrink-0 -space-x-3">
                  {visibleAvatars.map((m) => (
                    <Avatar
                      key={m.userId}
                      className="h-14 w-14 border-2 border-card ring-1 ring-border"
                    >
                      <AvatarImage src={m.avatar ?? undefined} />
                      <AvatarFallback className="bg-muted text-sm font-semibold">
                        {memberInitials(m)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {extraAvatarCount > 0 && (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-card bg-muted ring-1 ring-border text-xs font-semibold text-muted-foreground">
                      +{extraAvatarCount}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/80">
                      {isTeamDivision
                        ? "Team Registration"
                        : "Athlete Registration"}
                    </div>

                    {isTeamDivision && editingTeamName ? (
                      <div className="flex items-center gap-2 max-w-xl">
                        <Input
                          value={teamNameInput}
                          onChange={(e) => setTeamNameInput(e.target.value)}
                          autoFocus
                          disabled={isSavingTeamName}
                          className="h-auto py-2 text-2xl font-bold tracking-tight sm:text-3xl"
                        />
                        <Button
                          size="icon"
                          variant="default"
                          onClick={handleSaveTeamName}
                          disabled={isSavingTeamName}
                          aria-label="Save team name"
                          className="h-9 w-9 shrink-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingTeamName(false)
                            setTeamNameInput(detail.registration.teamName ?? "")
                          }}
                          disabled={isSavingTeamName}
                          aria-label="Cancel team name edit"
                          className="h-9 w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-2 min-w-0">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl truncate">
                          {detail.registration.teamName || displayTitle || (
                            <span className="italic font-normal text-muted-foreground">
                              Unnamed Team
                            </span>
                          )}
                        </h1>
                        {isTeamDivision && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingTeamName(true)}
                            aria-label="Edit team name"
                            className="h-7 w-7 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}

                    {isTeamDivision && captainName && (
                      <div className="text-sm text-muted-foreground">
                        Captain ·{" "}
                        <span className="text-foreground/80 font-medium">
                          {captainName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {detail.division && (
                      <Badge
                        variant="secondary"
                        className="font-medium tracking-wide"
                      >
                        {detail.division.label}
                      </Badge>
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
                    {detail.registration.paymentStatus && (
                      <Badge
                        variant="outline"
                        className={
                          isPaid
                            ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                            : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                        }
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        {detail.registration.paymentStatus}
                      </Badge>
                    )}
                    {activeTransfer && (
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800"
                        >
                          Transfer Pending → {activeTransfer.targetEmail}
                        </Badge>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                          title="Copy transfer link"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                `${window.location.origin}/transfer/${activeTransfer.id}`,
                              )
                              toast.success(
                                "Transfer link copied to clipboard",
                              )
                            } catch {
                              toast.error("Failed to copy link")
                            }
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-row items-center gap-2 shrink-0 sm:flex-row lg:self-start">
                <Button
                  variant="outline"
                  onClick={() => setShowTransferDialog(true)}
                  disabled={isRemoved}
                  className="bg-background/60 backdrop-blur-sm"
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Change Division
                </Button>
                {activeTransfer ? (
                  <Button
                    variant="outline"
                    onClick={handleCancelTransfer}
                    disabled={isCancellingTransfer}
                    className="bg-background/60 backdrop-blur-sm text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {isCancellingTransfer ? "Cancelling..." : "Cancel Transfer"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowTransferRegistrationDialog(true)}
                    disabled={!canTransferRegistration}
                    className="bg-background/60 backdrop-blur-sm"
                    title={
                      !detail.registration.commercePurchaseId
                        ? "This registration has no associated purchase and cannot be transferred."
                        : undefined
                    }
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Transfer Registration
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveDialog(true)}
                  disabled={isRemoved}
                  className="bg-background/60 backdrop-blur-sm text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>

            {/* META STRIP */}
            <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/60 pt-5 sm:grid-cols-4">
              <MetaField icon={CalendarDays} label="Registered">
                {formatDate(detail.registration.registeredAt)}
              </MetaField>
              <MetaField icon={CreditCard} label="Amount">
                {paidAmount ?? (
                  <span className="text-muted-foreground font-normal">—</span>
                )}
              </MetaField>
              <MetaField icon={Mail} label="Captain">
                <span className="truncate block font-mono text-xs">
                  {detail.captain?.email ?? "—"}
                </span>
              </MetaField>
              <MetaField icon={CreditCard} label="Status">
                {isPaid
                  ? "Paid in full"
                  : (detail.registration.paymentStatus ?? "—")}
              </MetaField>
            </div>
          </div>
        </section>

        {/* ROSTER SECTION */}
        <section className="space-y-5">
          <SectionHeading
            index={sectionIndex.roster}
            title={
              isTeamDivision
                ? `Roster · ${members.filter((m) => m.isActive).length + detail.pendingInvites.length} / ${detail.division?.teamSize ?? 1}`
                : "Roster"
            }
            description={
              isTeamDivision
                ? "Captain, teammates, and pending invitations. Profile edits update the user's account everywhere."
                : "Athlete profile. Editing name or email updates the user's account everywhere."
            }
            action={
              isTeamDivision &&
              detail.athleteTeam &&
              members.filter((m) => m.isActive).length +
                detail.pendingInvites.length <
                (detail.division?.teamSize ?? 1) ? (
                <Button
                  size="sm"
                  onClick={() => setShowAddTeammate(true)}
                  disabled={isRemoved}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Add Teammate
                </Button>
              ) : null
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            {members.map((m) => (
              <AthleteProfileCard
                key={m.userId}
                member={m}
                affiliate={metadataAffiliates?.[m.userId] ?? null}
                registrationId={detail.registration.id}
                competitionId={competition.id}
                onRemove={
                  !m.isCaptain && m.userId !== detail.registration.userId
                    ? () => setRemoveTeammateTarget(m)
                    : undefined
                }
              />
            ))}

            {isTeamDivision &&
              detail.pendingInvites.map((invite) => (
                <RosterSlotCard
                  key={invite.id}
                  variant="invite"
                  invite={invite}
                  registrationId={detail.registration.id}
                  competitionId={competition.id}
                  formatDate={formatDate}
                />
              ))}

            {isTeamDivision &&
              detail.athleteTeam &&
              Array.from({
                length: Math.max(
                  0,
                  (detail.division?.teamSize ?? 1) -
                    members.filter((m) => m.isActive).length -
                    detail.pendingInvites.length,
                ),
              }).map((_, idx) => (
                <RosterSlotCard
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable count of empty slots
                  key={`empty-${idx}`}
                  variant="empty"
                  onAdd={() => setShowAddTeammate(true)}
                  disabled={isRemoved}
                />
              ))}
          </div>
        </section>

        {/* REGISTRATION DETAILS SECTION */}
        {hasRegistrationDetails && (
          <section className="space-y-5">
            <SectionHeading
              index={sectionIndex.registration ?? "02"}
              title="Registration"
              description="Custom answers and waiver acknowledgements collected at sign-up."
            />

            <div
              className={
                detail.questions.length > 0 && detail.waivers.length > 0
                  ? "grid gap-5 lg:grid-cols-2 lg:items-start"
                  : "grid gap-5"
              }
            >
              {detail.questions.length > 0 && (
                <AnswersSection
                  registrationId={detail.registration.id}
                  competitionId={competition.id}
                  questions={detail.questions}
                  answers={detail.answers}
                  members={members}
                  pendingInvites={detail.pendingInvites}
                  isTeamDivision={isTeamDivision}
                />
              )}

              {detail.waivers.length > 0 && (
                <WaiversSection
                  waivers={detail.waivers}
                  waiverSignatures={detail.waiverSignatures}
                  members={members}
                  pendingInvites={detail.pendingInvites}
                  isTeamDivision={isTeamDivision}
                  formatDate={formatDate}
                />
              )}
            </div>
          </section>
        )}

        {/* SCORES / SUBMISSIONS SECTION */}
        <section className="space-y-5">
          <SectionHeading
            index={sectionIndex.scores}
            title={
              competition.competitionType === "online"
                ? "Video Submissions"
                : "Scores"
            }
            description={
              competition.competitionType === "online"
                ? "One card per event. Add, edit, or delete submissions and enter first scores inline."
                : "Event-by-event scores for this registration."
            }
          />

          {competition.competitionType === "online" ? (
            <VideoSubmissionsSection
              registrationId={detail.registration.id}
              competitionId={competition.id}
              organizingTeamId={competition.organizingTeamId}
              divisionId={detail.registration.divisionId}
              events={detail.events}
              videoSubmissions={detail.videoSubmissions}
              scores={detail.scores}
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
        </section>
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

      {/* Remove teammate dialog */}
      <AlertDialog
        open={!!removeTeammateTarget}
        onOpenChange={(open) => !open && setRemoveTeammateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove teammate</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{" "}
              <strong>
                {removeTeammateTarget
                  ? memberDisplayName(removeTeammateTarget)
                  : ""}
              </strong>{" "}
              from this team? Their user account remains intact — they just
              won't be part of this registration anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingTeammate}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveTeammate}
              disabled={isRemovingTeammate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingTeammate ? "Removing..." : "Remove teammate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add teammate dialog */}
      {isTeamDivision && detail.athleteTeam && (
        <AddTeammateDialog
          open={showAddTeammate}
          onOpenChange={setShowAddTeammate}
          registrationId={detail.registration.id}
          competitionId={competition.id}
          existingEmails={[
            ...members
              .filter((m) => m.isActive)
              .map((m) => m.email.toLowerCase()),
            ...detail.pendingInvites.map((p) => p.email.toLowerCase()),
          ]}
        />
      )}

      {/* Transfer registration (purchase transfer) dialog */}
      {showTransferRegistrationDialog && (
        <TransferRegistrationDialog
          open={showTransferRegistrationDialog}
          onOpenChange={(open) => {
            setShowTransferRegistrationDialog(open)
            if (!open) router.invalidate()
          }}
          registration={{
            id: detail.registration.id,
            athleteName: displayTitle,
            divisionId: detail.registration.divisionId,
            divisionLabel: detail.division?.label ?? null,
            commercePurchaseId: detail.registration.commercePurchaseId,
          }}
          competitionId={competition.id}
        />
      )}

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
