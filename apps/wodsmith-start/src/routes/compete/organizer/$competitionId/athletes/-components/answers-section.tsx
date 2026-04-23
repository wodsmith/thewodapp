import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, Clock, Pencil, UserCheck, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  updatePendingInviteAnswerAsOrganizerFn,
  updateRegistrationAnswerFn,
} from "@/server-fns/organizer-athlete-fns"
import {
  type AthleteDetailMember,
  type AthleteDetailPendingInvite,
  type AthleteDetailQuestion,
  memberDisplayName,
  memberInitials,
} from "./types"

function parseOptions(opts: string | null): string[] | null {
  if (!opts) return null
  try {
    const parsed = JSON.parse(opts)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

function inviteInitial(invite: AthleteDetailPendingInvite): string {
  return (invite.guestName?.[0] ?? invite.email[0] ?? "?").toUpperCase()
}

function inviteDisplayName(invite: AthleteDetailPendingInvite): string {
  return invite.guestName?.trim() || invite.email
}

type Participant =
  | { kind: "member"; member: AthleteDetailMember }
  | { kind: "invite"; invite: AthleteDetailPendingInvite }

interface AnswersSectionProps {
  registrationId: string
  competitionId: string
  questions: AthleteDetailQuestion[]
  answers: Record<string, string> // `${userId}:${questionId}` -> answer
  members: AthleteDetailMember[]
  pendingInvites: AthleteDetailPendingInvite[]
  isTeamDivision: boolean
}

export function AnswersSection({
  registrationId,
  competitionId,
  questions,
  answers,
  members,
  pendingInvites,
  isTeamDivision,
}: AnswersSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Answers</CardTitle>
        <CardDescription>
          Per-person answers from the registration form. Click any row to edit;
          clearing a field deletes the answer. Answers entered for pending
          invites are stored on the invitation and prefilled automatically when
          the teammate signs up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-7">
        {questions.map((question) => {
          const participants = buildParticipants({
            question,
            members,
            pendingInvites,
            isTeamDivision,
          })

          const totals = participants.reduce(
            (acc, p) => {
              const ans = getAnswerFor(p, question.id, answers)
              if (ans) acc.answered += 1
              acc.total += 1
              return acc
            },
            { answered: 0, total: 0 },
          )

          const allAnswered =
            totals.total > 0 && totals.answered === totals.total

          return (
            <div key={question.id} className="space-y-3">
              {/* Question header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{question.label}</div>
                    <Badge variant="secondary" className="text-[10px]">
                      {question.type}
                    </Badge>
                    {question.required && (
                      <Badge variant="outline" className="text-[10px]">
                        Required
                      </Badge>
                    )}
                  </div>
                  {question.helpText && (
                    <p className="text-xs text-muted-foreground max-w-prose">
                      {question.helpText}
                    </p>
                  )}
                </div>
                {totals.total > 0 && (
                  <span
                    className={
                      "font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums shrink-0 " +
                      (allAnswered
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground")
                    }
                  >
                    {totals.answered}/{totals.total} answered
                  </span>
                )}
              </div>

              {/* Per-participant rows */}
              <ul className="divide-y rounded-md border">
                {participants.map((p) =>
                  p.kind === "member" ? (
                    <MemberAnswerRow
                      key={`${question.id}-m-${p.member.userId}`}
                      registrationId={registrationId}
                      competitionId={competitionId}
                      question={question}
                      member={p.member}
                      currentAnswer={
                        answers[`${p.member.userId}:${question.id}`] ?? ""
                      }
                    />
                  ) : (
                    <InviteAnswerRow
                      key={`${question.id}-i-${p.invite.id}`}
                      registrationId={registrationId}
                      competitionId={competitionId}
                      question={question}
                      invite={p.invite}
                    />
                  ),
                )}
              </ul>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function buildParticipants({
  question,
  members,
  pendingInvites,
  isTeamDivision,
}: {
  question: AthleteDetailQuestion
  members: AthleteDetailMember[]
  pendingInvites: AthleteDetailPendingInvite[]
  isTeamDivision: boolean
}): Participant[] {
  const activeMembers = members.filter((m) => m.isActive)

  // Captain-only questions (forTeammates=false) never include pending invites.
  if (!question.forTeammates) {
    const captainOnly = activeMembers.filter((m) => m.isCaptain)
    const base = captainOnly.length > 0 ? captainOnly : activeMembers
    return base.map((m) => ({ kind: "member", member: m }))
  }

  const memberParticipants: Participant[] = activeMembers.map((m) => ({
    kind: "member",
    member: m,
  }))

  if (!isTeamDivision) return memberParticipants

  const inviteParticipants: Participant[] = pendingInvites.map((invite) => ({
    kind: "invite",
    invite,
  }))
  return [...memberParticipants, ...inviteParticipants]
}

function getAnswerFor(
  p: Participant,
  questionId: string,
  answers: Record<string, string>,
): string {
  if (p.kind === "member") {
    return answers[`${p.member.userId}:${questionId}`] ?? ""
  }
  return (
    p.invite.pendingAnswers?.find((a) => a.questionId === questionId)?.answer ??
    ""
  )
}

// ---------------------------------------------------------------------------
// Member row (editable inline)
// ---------------------------------------------------------------------------

interface MemberAnswerRowProps {
  registrationId: string
  competitionId: string
  question: AthleteDetailQuestion
  member: AthleteDetailMember
  currentAnswer: string
}

function MemberAnswerRow({
  registrationId,
  competitionId,
  question,
  member,
  currentAnswer,
}: MemberAnswerRowProps) {
  const router = useRouter()
  const updateAnswer = useServerFn(updateRegistrationAnswerFn)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentAnswer)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateAnswer({
        data: {
          registrationId,
          competitionId,
          userId: member.userId,
          questionId: question.id,
          answer: value,
        },
      })
      toast.success("Answer saved")
      setEditing(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save answer",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setValue(currentAnswer)
    setEditing(false)
  }

  const options = parseOptions(question.options)

  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage
            src={member.avatar ?? undefined}
            alt={memberDisplayName(member)}
          />
          <AvatarFallback className="text-[11px] font-semibold">
            {memberInitials(member)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium truncate">
              {memberDisplayName(member)}
            </span>
            <Badge
              variant={member.isCaptain ? "secondary" : "outline"}
              className="text-[10px] uppercase tracking-wide"
            >
              {member.isCaptain ? "Captain" : "Teammate"}
            </Badge>
          </div>

          {editing ? (
            <div className="flex items-start gap-2 mt-1">
              {question.type === "select" && options ? (
                <div className="flex items-center gap-1 flex-1 max-w-md">
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {value && (
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => setValue("")}
                      disabled={isSaving}
                      aria-label="Clear selection"
                      className="h-9 w-9 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : question.type === "number" ? (
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isSaving}
                  className="max-w-md"
                />
              ) : value.length > 60 ? (
                <Textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isSaving}
                  rows={3}
                  className="max-w-md"
                />
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isSaving}
                  className="max-w-md"
                />
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
                aria-label="Save answer"
                className="h-9 w-9 shrink-0"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
                aria-label="Cancel"
                className="h-9 w-9 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group flex w-full items-start justify-between gap-3 rounded-md text-left -mx-1 px-1 py-1 hover:bg-muted/60"
            >
              <span
                className={
                  currentAnswer
                    ? "text-sm break-words min-w-0 flex-1"
                    : "text-sm italic text-muted-foreground/70 min-w-0 flex-1"
                }
              >
                {currentAnswer || "Not answered"}
              </span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Pending-invite row (editable — writes to invitation.metadata.pendingAnswers)
// ---------------------------------------------------------------------------

interface InviteAnswerRowProps {
  registrationId: string
  competitionId: string
  question: AthleteDetailQuestion
  invite: AthleteDetailPendingInvite
}

function InviteAnswerRow({
  registrationId,
  competitionId,
  question,
  invite,
}: InviteAnswerRowProps) {
  const router = useRouter()
  const updateInviteAnswer = useServerFn(updatePendingInviteAnswerAsOrganizerFn)

  const currentAnswer =
    invite.pendingAnswers?.find((a) => a.questionId === question.id)?.answer ??
    ""
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentAnswer)
  const [isSaving, setIsSaving] = useState(false)

  const hasSubmitted = invite.status === "accepted" || !!invite.submittedAt
  const options = parseOptions(question.options)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateInviteAnswer({
        data: {
          invitationId: invite.id,
          registrationId,
          competitionId,
          questionId: question.id,
          answer: value,
        },
      })
      toast.success(
        value.trim() ? "Pre-filled for sign-up" : "Pending answer cleared",
      )
      setEditing(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save answer",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setValue(currentAnswer)
    setEditing(false)
  }

  return (
    <li className="p-3 bg-muted/20">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 shrink-0 rounded-full border border-dashed border-muted-foreground/40 bg-background flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
          {inviteInitial(invite)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-foreground/90 truncate">
              {inviteDisplayName(invite)}
            </span>
            {hasSubmitted ? (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wide bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                title="They filled out the registration form; account creation pending."
              >
                <UserCheck className="h-2.5 w-2.5 mr-1" />
                Awaiting sign-up
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                title="Invitation email sent — teammate hasn't opened the link yet."
              >
                <Clock className="h-2.5 w-2.5 mr-1" />
                Awaiting response
              </Badge>
            )}
          </div>

          {editing ? (
            <div className="flex items-start gap-2 mt-1">
              {question.type === "select" && options ? (
                <div className="flex items-center gap-1 flex-1 max-w-md">
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {value && (
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => setValue("")}
                      disabled={isSaving}
                      aria-label="Clear selection"
                      className="h-9 w-9 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : question.type === "number" ? (
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isSaving}
                  className="max-w-md"
                />
              ) : value.length > 60 ? (
                <Textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isSaving}
                  rows={3}
                  className="max-w-md"
                />
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isSaving}
                  className="max-w-md"
                />
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
                aria-label="Save answer"
                className="h-9 w-9 shrink-0"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
                aria-label="Cancel"
                className="h-9 w-9 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group flex w-full items-start justify-between gap-3 rounded-md text-left -mx-1 px-1 py-1 hover:bg-muted/60"
              title="Edit pending answer — prefilled at sign-up"
            >
              <span
                className={
                  currentAnswer
                    ? "text-sm break-words min-w-0 flex-1"
                    : "text-sm italic text-muted-foreground/70 min-w-0 flex-1"
                }
              >
                {currentAnswer || "Not answered"}
              </span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
            </button>
          )}

          {!editing && (
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60 mt-1">
              Prefilled at sign-up
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
