import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trackEvent } from "@/lib/posthog/utils"
import type { CompetitionDivisionWithCounts } from "@/server-fns/competition-divisions-fns"
import { createManualRegistrationFn } from "@/server-fns/registration-fns"
import type { RegistrationQuestionWithSource } from "@/server-fns/registration-questions-fns"

interface ManualRegistrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  competitionId: string
  divisions: CompetitionDivisionWithCounts[]
  questions: RegistrationQuestionWithSource[]
}

type Step = "athlete" | "division" | "team" | "questions" | "confirm"

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ManualRegistrationDialog({
  open,
  onOpenChange,
  competitionId,
  divisions,
  questions,
}: ManualRegistrationDialogProps) {
  const router = useRouter()
  const createManualRegistration = useServerFn(createManualRegistrationFn)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step state
  const [step, setStep] = useState<Step>("athlete")

  // Athlete info
  const [athleteEmail, setAthleteEmail] = useState("")
  const [athleteFirstName, setAthleteFirstName] = useState("")
  const [athleteLastName, setAthleteLastName] = useState("")

  // Division
  const [divisionId, setDivisionId] = useState("")

  // Team info
  const [teamName, setTeamName] = useState("")
  const [teammates, setTeammates] = useState<
    Array<{ email: string; firstName: string; lastName: string }>
  >([])

  // Questions
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // Payment
  const [paymentStatus, setPaymentStatus] = useState<"COMP" | "PAID_OFFLINE">(
    "COMP",
  )

  const selectedDivision = divisions.find((d) => d.id === divisionId)
  const isTeamDivision = (selectedDivision?.teamSize ?? 1) > 1
  const divisionFeeCents = selectedDivision?.feeCents ?? 0
  const isDivisionFree = divisionFeeCents === 0
  const isAtCapacity =
    selectedDivision?.maxSpots != null &&
    selectedDivision.registrationCount >= selectedDivision.maxSpots

  // Filter questions to non-teammate ones for the dialog
  const registrationQuestions = questions.filter((q) => !q.forTeammates)

  const resetForm = () => {
    setStep("athlete")
    setAthleteEmail("")
    setAthleteFirstName("")
    setAthleteLastName("")
    setDivisionId("")
    setTeamName("")
    setTeammates([])
    setAnswers({})
    setPaymentStatus("COMP")
  }

  // Step navigation
  const getSteps = (): Step[] => {
    const steps: Step[] = ["athlete", "division"]
    if (isTeamDivision) steps.push("team")
    if (registrationQuestions.length > 0) steps.push("questions")
    steps.push("confirm")
    return steps
  }

  const steps = getSteps()
  const currentStepIndex = steps.indexOf(step)

  const canGoNext = (): boolean => {
    switch (step) {
      case "athlete":
        return (
          athleteEmail.trim().length > 0 && /\S+@\S+\.\S+/.test(athleteEmail)
        )
      case "division":
        return divisionId.length > 0
      case "team":
        if (!teamName.trim()) return false
        return teammates.every(
          (t) => t.email.trim().length > 0 && /\S+@\S+\.\S+/.test(t.email),
        )
      case "questions": {
        const requiredQuestions = registrationQuestions.filter(
          (q) => q.required,
        )
        return requiredQuestions.every(
          (q) => answers[q.id] && answers[q.id].trim().length > 0,
        )
      }
      case "confirm":
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      // When moving to team step, initialize teammates array
      if (steps[nextIndex] === "team" && selectedDivision) {
        const teammateCount = selectedDivision.teamSize - 1
        if (teammates.length !== teammateCount) {
          setTeammates(
            Array.from({ length: teammateCount }, () => ({
              email: "",
              firstName: "",
              lastName: "",
            })),
          )
        }
      }
      setStep(steps[nextIndex])
    }
  }

  const goBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setStep(steps[prevIndex])
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const answersArray = Object.entries(answers)
        .filter(([, value]) => value.trim().length > 0)
        .map(([questionId, answer]) => ({ questionId, answer }))

      const result = await createManualRegistration({
        data: {
          competitionId,
          athleteEmail,
          athleteFirstName: athleteFirstName || undefined,
          athleteLastName: athleteLastName || undefined,
          divisionId,
          paymentStatus: isDivisionFree ? "COMP" : paymentStatus,
          answers: answersArray.length > 0 ? answersArray : undefined,
          teamName: isTeamDivision ? teamName : undefined,
          teammates: isTeamDivision ? teammates : undefined,
        },
      })

      // Track PostHog event
      trackEvent("manual_registration_created", {
        competition_id: competitionId,
        division_id: divisionId,
        payment_status: isDivisionFree ? "FREE" : paymentStatus,
        division_fee_cents: result.divisionFeeCents,
        is_new_athlete: result.isNewAthlete,
        is_team_registration: isTeamDivision,
      })

      toast.success("Registration created successfully")
      onOpenChange(false)
      resetForm()
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create registration",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateTeammate = (
    index: number,
    field: "email" | "firstName" | "lastName",
    value: string,
  ) => {
    setTeammates((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Registration</DialogTitle>
          <DialogDescription>
            Manually register an athlete for this competition.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span
                className={
                  s === step
                    ? "font-medium text-foreground"
                    : i < currentStepIndex
                      ? "text-foreground/70"
                      : ""
                }
              >
                {s === "athlete"
                  ? "Athlete"
                  : s === "division"
                    ? "Division"
                    : s === "team"
                      ? "Team"
                      : s === "questions"
                        ? "Questions"
                        : "Confirm"}
              </span>
            </span>
          ))}
        </div>

        {/* Step: Athlete Info */}
        {step === "athlete" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="athlete-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="athlete-email"
                type="email"
                placeholder="athlete@example.com"
                value={athleteEmail}
                onChange={(e) => setAthleteEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="athlete-first-name">First Name</Label>
                <Input
                  id="athlete-first-name"
                  placeholder="Jane"
                  value={athleteFirstName}
                  onChange={(e) => setAthleteFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="athlete-last-name">Last Name</Label>
                <Input
                  id="athlete-last-name"
                  placeholder="Doe"
                  value={athleteLastName}
                  onChange={(e) => setAthleteLastName(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              If the athlete doesn't have an account, a placeholder will be
              created. They can claim it by signing up with this email.
            </p>
          </div>
        )}

        {/* Step: Division Selection */}
        {step === "division" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="division-select">
                Division <span className="text-destructive">*</span>
              </Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger id="division-select">
                  <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      <span className="flex items-center gap-2">
                        {division.label}
                        <span className="text-muted-foreground text-xs">
                          ({division.registrationCount}
                          {division.maxSpots != null
                            ? `/${division.maxSpots}`
                            : " registered"}
                          )
                          {division.teamSize > 1 && (
                            <> &middot; Team of {division.teamSize}</>
                          )}
                          {division.feeCents != null &&
                            division.feeCents > 0 && (
                              <> &middot; {formatCents(division.feeCents)}</>
                            )}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAtCapacity && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-500">
                  This division is at capacity (
                  {selectedDivision!.registrationCount}/
                  {selectedDivision!.maxSpots}). You can still add a
                  registration as an organizer.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Team Info */}
        {step === "team" && selectedDivision && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="team-name">
                Team Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-name"
                placeholder="Team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>
                Teammates ({selectedDivision.teamSize - 1} required)
              </Label>
              {teammates.map((teammate, index) => (
                <div key={index} className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Teammate {index + 1}
                  </p>
                  <Input
                    type="email"
                    placeholder="teammate@example.com"
                    value={teammate.email}
                    onChange={(e) =>
                      updateTeammate(index, "email", e.target.value)
                    }
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="First name"
                      value={teammate.firstName}
                      onChange={(e) =>
                        updateTeammate(index, "firstName", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Last name"
                      value={teammate.lastName}
                      onChange={(e) =>
                        updateTeammate(index, "lastName", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Registration Questions */}
        {step === "questions" && (
          <div className="space-y-4 py-2">
            {registrationQuestions.map((question) => (
              <div key={question.id} className="space-y-2">
                <Label htmlFor={`question-${question.id}`}>
                  {question.label}
                  {question.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                {question.helpText && (
                  <p className="text-xs text-muted-foreground">
                    {question.helpText}
                  </p>
                )}
                {question.type === "select" && question.options ? (
                  <Select
                    value={answers[question.id] || ""}
                    onValueChange={(value) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: value,
                      }))
                    }
                  >
                    <SelectTrigger id={`question-${question.id}`}>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {question.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`question-${question.id}`}
                    type={question.type === "number" ? "number" : "text"}
                    value={answers[question.id] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4 py-2">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Athlete</span>
                <span className="font-medium">
                  {athleteFirstName || athleteLastName
                    ? `${athleteFirstName} ${athleteLastName}`.trim()
                    : athleteEmail}
                </span>
              </div>
              {(athleteFirstName || athleteLastName) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{athleteEmail}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Division</span>
                <Badge variant="outline">{selectedDivision?.label}</Badge>
              </div>
              {isTeamDivision && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team</span>
                    <span className="font-medium">{teamName}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">Teammates</span>
                    <div className="text-right">
                      {teammates.map((t, i) => (
                        <div key={i}>
                          {t.firstName || t.lastName
                            ? `${t.firstName} ${t.lastName}`.trim()
                            : t.email}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {Object.entries(answers).filter(([, v]) => v.trim()).length >
                0 && (
                <div className="border-t pt-3 space-y-2">
                  <span className="text-muted-foreground font-medium">
                    Answers
                  </span>
                  {Object.entries(answers)
                    .filter(([, v]) => v.trim())
                    .map(([qId, answer]) => {
                      const question = registrationQuestions.find(
                        (q) => q.id === qId,
                      )
                      return (
                        <div key={qId} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {question?.label}
                          </span>
                          <span>{answer}</span>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              {isDivisionFree ? (
                <p className="text-sm text-muted-foreground">
                  This division has no registration fee.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Registration fee: {formatCents(divisionFeeCents)}
                  </p>
                  <RadioGroup
                    value={paymentStatus}
                    onValueChange={(value) =>
                      setPaymentStatus(value as "COMP" | "PAID_OFFLINE")
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="COMP" id="payment-comp" />
                      <Label htmlFor="payment-comp" className="font-normal">
                        Comp'd &mdash; no payment required
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="PAID_OFFLINE"
                        id="payment-offline"
                      />
                      <Label htmlFor="payment-offline" className="font-normal">
                        Paid Offline &mdash; cash, check, or other
                      </Label>
                    </div>
                  </RadioGroup>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {currentStepIndex > 0 && (
              <Button
                variant="outline"
                onClick={goBack}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {step === "confirm" ? (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Registering..." : "Register"}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canGoNext()}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
