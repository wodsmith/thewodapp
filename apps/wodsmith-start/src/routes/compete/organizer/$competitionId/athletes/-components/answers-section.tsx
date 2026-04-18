import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, Pencil, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
import { updateRegistrationAnswerFn } from "@/server-fns/organizer-athlete-fns"
import {
  type AthleteDetailMember,
  type AthleteDetailQuestion,
  memberDisplayName,
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

interface AnswersSectionProps {
  registrationId: string
  competitionId: string
  questions: AthleteDetailQuestion[]
  answers: Record<string, string> // `${userId}:${questionId}` -> answer
  members: AthleteDetailMember[]
  isTeamDivision: boolean
}

export function AnswersSection({
  registrationId,
  competitionId,
  questions,
  answers,
  members,
  isTeamDivision,
}: AnswersSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Answers</CardTitle>
        <CardDescription>
          Answers supplied during registration. Edits save immediately —
          clearing a field deletes the answer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((question) => {
          const applicableMembers = question.forTeammates
            ? members.filter((m) => m.isActive)
            : members.filter((m) => m.isCaptain && m.isActive)
          const effectiveMembers =
            applicableMembers.length > 0 ? applicableMembers : members
          return (
            <div key={question.id} className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium">{question.label}</div>
                  <Badge variant="secondary" className="text-xs">
                    {question.type}
                  </Badge>
                  {question.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                {question.helpText && (
                  <p className="text-xs text-muted-foreground">
                    {question.helpText}
                  </p>
                )}
              </div>
              <div className="space-y-2 pl-2 border-l-2">
                {effectiveMembers.map((member) => (
                  <AnswerRow
                    key={`${question.id}-${member.userId}`}
                    registrationId={registrationId}
                    competitionId={competitionId}
                    question={question}
                    member={member}
                    showMemberLabel={
                      isTeamDivision && effectiveMembers.length > 1
                    }
                    currentAnswer={
                      answers[`${member.userId}:${question.id}`] ?? ""
                    }
                  />
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

interface AnswerRowProps {
  registrationId: string
  competitionId: string
  question: AthleteDetailQuestion
  member: AthleteDetailMember
  showMemberLabel: boolean
  currentAnswer: string
}

function AnswerRow({
  registrationId,
  competitionId,
  question,
  member,
  showMemberLabel,
  currentAnswer,
}: AnswerRowProps) {
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

  return (
    <div className="flex items-start gap-3 py-2">
      {showMemberLabel && (
        <div className="text-xs text-muted-foreground w-32 shrink-0 pt-2 truncate">
          {memberDisplayName(member)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-start gap-2">
            {question.type === "select" && parseOptions(question.options) ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {(parseOptions(question.options) ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            className="group flex items-start gap-2 text-left w-full rounded-md hover:bg-muted/50 -mx-2 px-2 py-1.5"
          >
            <span
              className={
                currentAnswer
                  ? "text-sm flex-1"
                  : "text-sm italic text-muted-foreground flex-1"
              }
            >
              {currentAnswer || "Not answered"}
            </span>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}
