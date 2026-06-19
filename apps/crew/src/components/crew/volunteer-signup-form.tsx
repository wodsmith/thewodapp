"use client"

import { useServerFn } from "@tanstack/react-start"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { Textarea } from "../ui/textarea"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_LABELS,
  VOLUNTEER_ROLE_TYPES,
  VOLUNTEER_ROLE_TYPE_VALUES,
  type VolunteerRoleType,
} from "../../db/schemas/volunteers"
import {
  submitCrewVolunteerSignupFn,
  type PublicCrewVolunteerEvent,
  type PublicCrewVolunteerQuestion,
  type PublicCrewVolunteerWaiver,
} from "../../server-fns/crew-volunteer-fns"
import { WaiverViewer } from "../compete/waiver-viewer"

interface CrewVolunteerSignupFormProps {
  event: PublicCrewVolunteerEvent
  questions: PublicCrewVolunteerQuestion[]
  waivers: PublicCrewVolunteerWaiver[]
}

export function CrewVolunteerSignupForm({
  event,
  questions,
  waivers,
}: CrewVolunteerSignupFormProps) {
  const submitCrewVolunteerSignup = useServerFn(submitCrewVolunteerSignupFn)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [agreedWaivers, setAgreedWaivers] = useState<Set<string>>(new Set())
  const [selectedRoleTypes, setSelectedRoleTypes] = useState<
    Set<VolunteerRoleType>
  >(new Set([VOLUNTEER_ROLE_TYPES.GENERAL]))

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const toggleRoleType = (roleType: VolunteerRoleType, checked: boolean) => {
    setSelectedRoleTypes((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(roleType)
      } else {
        next.delete(roleType)
      }
      return next
    })
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true)
    setError(null)

    for (const question of questions) {
      if (
        question.required &&
        (!answers[question.id] || answers[question.id].trim() === "")
      ) {
        setError(`Please answer the required question: "${question.label}"`)
        setIsPending(false)
        return
      }
    }

    const missingWaiver = waivers.find(
      (waiver) => !agreedWaivers.has(waiver.id),
    )
    if (missingWaiver) {
      setError("Please agree to all required waivers before volunteering")
      setIsPending(false)
      return
    }

    const answersArray = Object.entries(answers)
      .filter(([, value]) => value.trim() !== "")
      .map(([questionId, answer]) => ({ questionId, answer }))

    try {
      await submitCrewVolunteerSignup({
        data: {
          eventSlug: event.slug,
          signupName: String(formData.get("name") ?? ""),
          signupEmail: String(formData.get("email") ?? ""),
          signupPhone: String(formData.get("phone") ?? ""),
          credentials: String(formData.get("credentials") ?? ""),
          availability: String(
            formData.get("availability") ?? VOLUNTEER_AVAILABILITY.ALL_DAY,
          ) as "morning" | "afternoon" | "all_day",
          availabilityNotes: String(formData.get("availabilityNotes") ?? ""),
          roleTypes: Array.from(selectedRoleTypes),
          answers: answersArray,
          waiverIds: Array.from(agreedWaivers),
          website: String(formData.get("website") ?? ""),
        },
      })
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      )
    } finally {
      setIsPending(false)
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">You're on the volunteer list</h2>
            <p className="text-muted-foreground">
              Your volunteer application for{" "}
              <span className="font-medium">{event.name}</span> has been
              received. The organizers will review your details and follow up
              with next steps.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volunteer for {event.name}</CardTitle>
        <CardDescription>
          Share your contact details, availability, and preferred roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          <div className="sr-only" aria-hidden="true">
            <Label htmlFor="website">Website</Label>
            <Input
              type="text"
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                type="text"
                id="name"
                name="name"
                required
                disabled={isPending}
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                id="email"
                name="email"
                required
                disabled={isPending}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              type="tel"
              id="phone"
              name="phone"
              placeholder="(555) 123-4567"
              disabled={isPending}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-3">
            <Label>Preferred roles</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {VOLUNTEER_ROLE_TYPE_VALUES.map((roleType) => (
                <div key={roleType} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${roleType}`}
                    checked={selectedRoleTypes.has(roleType)}
                    onCheckedChange={(checked) =>
                      toggleRoleType(roleType, checked === true)
                    }
                    disabled={isPending}
                  />
                  <Label
                    htmlFor={`role-${roleType}`}
                    className="cursor-pointer font-normal"
                  >
                    {VOLUNTEER_ROLE_LABELS[roleType]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credentials">Certifications or credentials</Label>
            <Textarea
              id="credentials"
              name="credentials"
              placeholder="Judging certifications, medical training, event ops experience..."
              rows={3}
              disabled={isPending}
            />
          </div>

          <div className="space-y-3">
            <Label>
              Availability <span className="text-destructive">*</span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <RadioOption
                id="availability-morning"
                name="availability"
                value={VOLUNTEER_AVAILABILITY.MORNING}
                label="Morning"
                disabled={isPending}
              />
              <RadioOption
                id="availability-afternoon"
                name="availability"
                value={VOLUNTEER_AVAILABILITY.AFTERNOON}
                label="Afternoon"
                disabled={isPending}
              />
              <RadioOption
                id="availability-all-day"
                name="availability"
                value={VOLUNTEER_AVAILABILITY.ALL_DAY}
                label="All day"
                disabled={isPending}
                defaultChecked
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availabilityNotes">Availability notes</Label>
            <Textarea
              id="availabilityNotes"
              name="availabilityNotes"
              placeholder="Timing constraints, role preferences, or anything else organizers should know..."
              rows={3}
              disabled={isPending}
            />
          </div>

          {waivers.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-sm font-medium">Required waivers</p>
              {waivers.map((waiver) => (
                <div
                  key={waiver.id}
                  className="space-y-3 rounded-md border p-4"
                >
                  <h3 className="font-medium">{waiver.title}</h3>
                  <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/10 p-4">
                    <WaiverViewer
                      content={waiver.content}
                      className="prose prose-sm max-w-none dark:prose-invert"
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-md bg-muted/20 p-4">
                    <Checkbox
                      id={`waiver-${waiver.id}`}
                      checked={agreedWaivers.has(waiver.id)}
                      onCheckedChange={(checked) => {
                        setAgreedWaivers((current) => {
                          const next = new Set(current)
                          if (checked === true) {
                            next.add(waiver.id)
                          } else {
                            next.delete(waiver.id)
                          }
                          return next
                        })
                      }}
                      disabled={isPending}
                    />
                    <Label
                      htmlFor={`waiver-${waiver.id}`}
                      className="cursor-pointer text-sm font-medium leading-none"
                    >
                      I have read and agree to this waiver
                      <span className="ml-1 text-destructive">*</span>
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {questions.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-sm font-medium">Additional questions</p>
              {questions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <Label htmlFor={question.id}>
                    {question.label}
                    {question.required && (
                      <span className="ml-1 text-destructive">*</span>
                    )}
                  </Label>
                  {question.helpText && (
                    <p className="text-sm text-muted-foreground">
                      {question.helpText}
                    </p>
                  )}
                  <QuestionInput
                    question={question}
                    value={answers[question.id] ?? ""}
                    disabled={isPending}
                    onChange={(value) => handleAnswerChange(question.id, value)}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Sign up to volunteer"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface RadioOptionProps {
  id: string
  name: string
  value: string
  label: string
  disabled: boolean
  defaultChecked?: boolean
}

function RadioOption({
  id,
  name,
  value,
  label,
  disabled,
  defaultChecked,
}: RadioOptionProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-3">
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        required
        disabled={disabled}
        defaultChecked={defaultChecked}
        className="h-4 w-4"
      />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  )
}

interface QuestionInputProps {
  question: PublicCrewVolunteerQuestion
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

function QuestionInput({
  question,
  value,
  disabled,
  onChange,
}: QuestionInputProps) {
  if (question.type === "number") {
    return (
      <Input
        id={question.id}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    )
  }

  if (question.type === "select" && question.options) {
    return (
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={question.id}>
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
    )
  }

  return (
    <Input
      id={question.id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  )
}
