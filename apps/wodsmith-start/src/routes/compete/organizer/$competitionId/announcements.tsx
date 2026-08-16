/**
 * Competition Announcements Route
 *
 * Organizer page for sending one-way broadcast messages to athletes.
 * Supports audience filtering by division, volunteer role, and registration question answers.
 */
// @lat: [[organizer-dashboard#Event announcements]]

import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { Filter, Megaphone, Plus, Send, Users, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Waiver } from "@/db/schemas/waivers"
import type { QuestionFilter, WaiverFilter } from "@/server-fns/broadcast-fns"
import {
  getDistinctAnswersFn,
  listBroadcastsFn,
  previewAudienceFn,
  sendBroadcastFn,
} from "@/server-fns/broadcast-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"
import {
  getCompetitionQuestionsFn,
  getVolunteerQuestionsFn,
} from "@/server-fns/registration-questions-fns"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/announcements",
)({
  staleTime: 10_000,
  component: BroadcastsPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    if (!parentMatch.loaderData) {
      throw new Error("Competition data is unavailable")
    }
    const { competition } = parentMatch.loaderData

    const [
      { broadcasts },
      divisionsResult,
      { questions: athleteQuestions },
      { questions: volunteerQuestions },
      { waivers },
    ] = await Promise.all([
      listBroadcastsFn({ data: { competitionId: params.competitionId } }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      getCompetitionQuestionsFn({
        data: { competitionId: params.competitionId },
      }),
      getVolunteerQuestionsFn({
        data: { competitionId: params.competitionId },
      }),
      getCompetitionWaiversFn({
        data: { competitionId: params.competitionId },
      }),
    ])

    const divisions = (divisionsResult.divisions ?? []).map(
      (d: { id: string; label: string }) => ({
        id: d.id,
        name: d.label,
      }),
    )

    return {
      broadcasts,
      divisions,
      athleteQuestions,
      volunteerQuestions,
      athleteWaivers: waivers.filter((waiver) => waiver.required),
    }
  },
})

function BroadcastsPage() {
  const {
    broadcasts,
    divisions,
    athleteQuestions,
    volunteerQuestions,
    athleteWaivers,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const router = useRouter()
  const [isComposing, setIsComposing] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Event announcements
          </h1>
          <p className="text-muted-foreground">
            Send event updates to athletes, volunteers, or both.
          </p>
        </div>
        {!isComposing && (
          <Button onClick={() => setIsComposing(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New announcement
          </Button>
        )}
      </div>

      {isComposing && (
        <ComposeCard
          competitionId={competition.id}
          divisions={divisions}
          athleteQuestions={athleteQuestions}
          volunteerQuestions={volunteerQuestions}
          athleteWaivers={athleteWaivers}
          onSent={() => {
            setIsComposing(false)
            router.invalidate()
          }}
          onCancel={() => setIsComposing(false)}
        />
      )}

      {broadcasts.length === 0 && !isComposing ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              No event announcements yet
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Send your first announcement to communicate with athletes and
              volunteers.
            </p>
            <Button onClick={() => setIsComposing(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {broadcasts.map((broadcast) => (
            <Card key={broadcast.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{broadcast.title}</CardTitle>
                  <Badge variant="secondary">Sent</Badge>
                </div>
                <CardDescription>
                  {broadcast.sentAt
                    ? new Date(broadcast.sentAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Draft"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {broadcast.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Compose Card
// ============================================================================

interface Division {
  id: string
  name: string
}

type AudienceFilterType =
  | "all"
  | "division"
  | "public"
  | "volunteers"
  | "volunteer_role"
  | "pending_teammates"

const VOLUNTEER_ROLES = [
  { value: "judge", label: "Judge" },
  { value: "head_judge", label: "Head Judge" },
  { value: "scorekeeper", label: "Scorekeeper" },
  { value: "check_in", label: "Check-In" },
  { value: "medical", label: "Medical" },
  { value: "emcee", label: "Emcee" },
  { value: "floor_manager", label: "Floor Manager" },
  { value: "equipment", label: "Equipment" },
  { value: "equipment_team", label: "Equipment Team" },
  { value: "media", label: "Media" },
  { value: "athlete_control", label: "Athlete Control" },
  { value: "staff", label: "Staff" },
  { value: "general", label: "General" },
]

function ComposeCard({
  competitionId,
  divisions,
  athleteQuestions,
  volunteerQuestions,
  athleteWaivers,
  onSent,
  onCancel,
}: {
  competitionId: string
  divisions: Division[]
  athleteQuestions: RegistrationQuestion[]
  volunteerQuestions: RegistrationQuestion[]
  athleteWaivers: Waiver[]
  onSent: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [filterType, setFilterType] = useState<AudienceFilterType>("all")
  const [divisionId, setDivisionId] = useState<string>("")
  const [volunteerRole, setVolunteerRole] = useState<string>("")
  const [questionFilters, setQuestionFilters] = useState<QuestionFilter[]>([])
  const [waiverFilters, setWaiverFilters] = useState<WaiverFilter[]>([])
  const [shouldSendEmail, setShouldSendEmail] = useState(true)
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [showQuestionFilters, setShowQuestionFilters] = useState(false)

  // Determine which questions to show based on audience type
  const relevantQuestions = useMemo(() => {
    const isAthleteAudience = filterType === "all" || filterType === "division"
    const isVolunteerAudience =
      filterType === "volunteers" || filterType === "volunteer_role"
    const isPublic = filterType === "public"

    if (isAthleteAudience) return athleteQuestions
    if (isVolunteerAudience) return volunteerQuestions
    if (isPublic) return [...athleteQuestions, ...volunteerQuestions]
    // pending_teammates: invitees have no answers; skip question filtering
    return []
  }, [filterType, athleteQuestions, volunteerQuestions])

  const relevantWaivers =
    filterType === "all" || filterType === "division" ? athleteWaivers : []

  const audienceFilter = useMemo(() => {
    const base =
      filterType === "division" && divisionId
        ? { type: "division" as const, divisionId }
        : filterType === "volunteer_role" && volunteerRole
          ? { type: "volunteer_role" as const, volunteerRole }
          : filterType === "pending_teammates"
            ? divisionId
              ? {
                  type: "pending_teammates" as const,
                  divisionId,
                }
              : { type: "pending_teammates" as const }
            : {
                type: filterType as "all" | "public" | "volunteers",
              }

    if (questionFilters.length > 0 || waiverFilters.length > 0) {
      return {
        ...base,
        ...(questionFilters.length > 0 ? { questionFilters } : {}),
        ...(waiverFilters.length > 0 ? { waiverFilters } : {}),
      }
    }
    return base
  }, [filterType, divisionId, volunteerRole, questionFilters, waiverFilters])

  // Auto-fetch recipient count when filter is complete
  const filterReady =
    (filterType !== "division" || !!divisionId) &&
    (filterType !== "volunteer_role" || !!volunteerRole)

  // Debounce the preview call
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!filterReady) {
      setAudienceCount(null)
      setIsPreviewing(false)
      return
    }
    let cancelled = false
    setIsPreviewing(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      previewAudienceFn({
        data: { competitionId, audienceFilter },
      })
        .then((result) => {
          if (!cancelled) setAudienceCount(result.count)
        })
        .catch(() => {
          if (!cancelled) setAudienceCount(null)
        })
        .finally(() => {
          if (!cancelled) setIsPreviewing(false)
        })
    }, 300)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filterReady, audienceFilter, competitionId])

  const updateQuestionFilter = useCallback(
    (questionId: string, values: string[]) => {
      setQuestionFilters((prev) => {
        if (values.length === 0) {
          return prev.filter((f) => f.questionId !== questionId)
        }
        const existing = prev.find((f) => f.questionId === questionId)
        if (existing) {
          return prev.map((f) =>
            f.questionId === questionId ? { ...f, values } : f,
          )
        }
        return [...prev, { questionId, values }]
      })
      setAudienceCount(null)
    },
    [],
  )

  const updateWaiverFilter = useCallback(
    (waiverId: string, status: WaiverFilter["status"] | null) => {
      setWaiverFilters((prev) => {
        if (!status) {
          return prev.filter((filter) => filter.waiverId !== waiverId)
        }
        const existing = prev.find((filter) => filter.waiverId === waiverId)
        if (existing) {
          return prev.map((filter) =>
            filter.waiverId === waiverId ? { ...filter, status } : filter,
          )
        }
        return [...prev, { waiverId, status }]
      })
      setAudienceCount(null)
    },
    [],
  )

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required")
      return
    }

    if (filterType === "division" && !divisionId) {
      toast.error("Please select a division")
      return
    }

    if (filterType === "volunteer_role" && !volunteerRole) {
      toast.error("Please select a volunteer role")
      return
    }

    setIsSending(true)
    try {
      const result = await sendBroadcastFn({
        data: {
          competitionId,
          title: title.trim(),
          body: body.trim(),
          audienceFilter,
          sendEmail: shouldSendEmail,
        },
      })
      toast.success(
        `Announcement sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}`,
      )
      onSent()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send announcement",
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New announcement</CardTitle>
        <CardDescription>
          Compose a message to send to athletes, volunteers, or everyone via
          email and in-app notification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g., Schedule Change for Saturday"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            placeholder="Write your announcement..."
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Audience</Label>
          <div className="flex gap-3">
            <Select
              value={filterType}
              onValueChange={(v) => {
                setFilterType(v as AudienceFilterType)
                setDivisionId("")
                setVolunteerRole("")
                setQuestionFilters([])
                setWaiverFilters([])
                setShowQuestionFilters(false)
                setAudienceCount(null)
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Everyone (Public)</SelectItem>
                <SelectItem value="all">All Athletes</SelectItem>
                <SelectItem value="division">Athletes by Division</SelectItem>
                <SelectItem value="volunteers">All Volunteers</SelectItem>
                <SelectItem value="volunteer_role">
                  Volunteers by Role
                </SelectItem>
                <SelectItem value="pending_teammates">
                  Pending Teammate Invites
                </SelectItem>
              </SelectContent>
            </Select>

            {(filterType === "division" ||
              filterType === "pending_teammates") && (
              <Select
                value={divisionId}
                onValueChange={(v) => {
                  setDivisionId(v)
                  setAudienceCount(null)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((div) => (
                    <SelectItem key={div.id} value={div.id}>
                      {div.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filterType === "volunteer_role" && (
              <Select
                value={volunteerRole}
                onValueChange={(v) => {
                  setVolunteerRole(v)
                  setAudienceCount(null)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {VOLUNTEER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {isPreviewing
                ? "Counting..."
                : audienceCount !== null
                  ? `${audienceCount} recipient${audienceCount === 1 ? "" : "s"}`
                  : ""}
            </span>
          </div>
        </div>

        {/* Registration filters — hidden for "Everyone (Public)" since it targets all users */}
        {filterReady &&
          filterType !== "public" &&
          (relevantQuestions.length > 0 || relevantWaivers.length > 0) && (
            <div className="space-y-3">
              {!showQuestionFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuestionFilters(true)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filter by registration details
                </Button>
              ) : (
                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Filter by registration details
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Close registration filters"
                      onClick={() => {
                        setShowQuestionFilters(false)
                        setQuestionFilters([])
                        setWaiverFilters([])
                        setAudienceCount(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Narrow recipients by question answers or waiver status.
                    Multiple filters are combined with AND logic.
                  </p>
                  <div className="space-y-4">
                    {relevantQuestions.length > 0 && (
                      <div className="space-y-4">
                        {relevantWaivers.length > 0 && (
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Registration questions
                          </p>
                        )}
                        {relevantQuestions.map((question) => (
                          <QuestionFilterRow
                            key={question.id}
                            question={question}
                            competitionId={competitionId}
                            selectedValues={
                              questionFilters.find(
                                (f) => f.questionId === question.id,
                              )?.values ?? []
                            }
                            onChange={(values) =>
                              updateQuestionFilter(question.id, values)
                            }
                          />
                        ))}
                      </div>
                    )}
                    {relevantWaivers.length > 0 && (
                      <div className="space-y-3">
                        {relevantQuestions.length > 0 && (
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Waivers
                          </p>
                        )}
                        {relevantWaivers.map((waiver) => (
                          <WaiverFilterRow
                            key={waiver.id}
                            waiver={waiver}
                            selectedStatus={
                              waiverFilters.find(
                                (filter) => filter.waiverId === waiver.id,
                              )?.status ?? null
                            }
                            onChange={(status) =>
                              updateWaiverFilter(waiver.id, status)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Active question filter chips */}
              {questionFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {questionFilters.map((f) => {
                    const question = relevantQuestions.find(
                      (q) => q.id === f.questionId,
                    )
                    return (
                      <Badge
                        key={f.questionId}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {question?.label}: {f.values.join(", ")}
                        <button
                          type="button"
                          aria-label={
                            question
                              ? `Remove filter for ${question.label}`
                              : "Remove filter"
                          }
                          onClick={() => updateQuestionFilter(f.questionId, [])}
                          className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
              {waiverFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {waiverFilters.map((filter) => {
                    const waiver = relevantWaivers.find(
                      (candidate) => candidate.id === filter.waiverId,
                    )
                    return (
                      <Badge
                        key={filter.waiverId}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {waiver?.title}:{" "}
                        {filter.status === "signed" ? "Signed" : "Not signed"}
                        <button
                          type="button"
                          aria-label={
                            waiver
                              ? `Remove filter for ${waiver.title}`
                              : "Remove waiver filter"
                          }
                          onClick={() =>
                            updateWaiverFilter(filter.waiverId, null)
                          }
                          className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shouldSendEmail}
            onChange={(e) => setShouldSendEmail(e.target.checked)}
            className="rounded border-border"
          />
          Send email notification to recipients
        </label>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !title.trim() || !body.trim()}
          >
            <Send className="mr-2 h-4 w-4" />
            {isSending ? "Sending..." : "Send announcement"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function WaiverFilterRow({
  waiver,
  selectedStatus,
  onChange,
}: {
  waiver: Waiver
  selectedStatus: WaiverFilter["status"] | null
  onChange: (status: WaiverFilter["status"] | null) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
      <Label htmlFor={`waiver-filter-${waiver.id}`} className="text-sm">
        {waiver.title}
      </Label>
      <Select
        value={selectedStatus ?? "any"}
        onValueChange={(value) =>
          onChange(value === "any" ? null : (value as WaiverFilter["status"]))
        }
      >
        <SelectTrigger id={`waiver-filter-${waiver.id}`} className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any status</SelectItem>
          <SelectItem value="unsigned">Not signed</SelectItem>
          <SelectItem value="signed">Signed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

// ============================================================================
// Question Filter Row
// ============================================================================

function QuestionFilterRow({
  question,
  competitionId,
  selectedValues,
  onChange,
}: {
  question: RegistrationQuestion
  competitionId: string
  selectedValues: string[]
  onChange: (values: string[]) => void
}) {
  if (question.type === "select" && question.options) {
    return (
      <div className="space-y-2">
        <Label className="text-sm">{question.label}</Label>
        <div className="flex flex-wrap gap-3">
          {question.options.map((option, optionIndex) => {
            const checked = selectedValues.includes(option)
            const id = `qf-${question.id}-${optionIndex}`
            return (
              <div key={option} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) {
                      onChange([...selectedValues, option])
                    } else {
                      onChange(selectedValues.filter((v) => v !== option))
                    }
                  }}
                />
                <Label
                  htmlFor={id}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Text/Number questions — tag input with autocomplete
  return (
    <TextQuestionFilter
      question={question}
      competitionId={competitionId}
      selectedValues={selectedValues}
      onChange={onChange}
    />
  )
}

// ============================================================================
// Text/Number Question Filter with Autocomplete
// ============================================================================

function TextQuestionFilter({
  question,
  competitionId,
  selectedValues,
  onChange,
}: {
  question: RegistrationQuestion
  competitionId: string
  selectedValues: string[]
  onChange: (values: string[]) => void
}) {
  const [inputValue, setInputValue] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true)
    try {
      const result = await getDistinctAnswersFn({
        data: {
          competitionId,
          questionId: question.id,
          questionTarget: question.questionTarget,
        },
      })
      setSuggestions(result.values.filter((v) => !selectedValues.includes(v)))
    } catch {
      setSuggestions([])
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [competitionId, question.id, question.questionTarget, selectedValues])

  const addValue = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !selectedValues.includes(trimmed)) {
      onChange([...selectedValues, trimmed])
    }
    setInputValue("")
    setShowSuggestions(false)
  }

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !selectedValues.includes(s) &&
      s.toLowerCase().includes(inputValue.toLowerCase()),
  )

  return (
    <div className="space-y-2">
      <Label className="text-sm">{question.label}</Label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedValues.map((val) => (
          <Badge key={val} variant="secondary" className="gap-1 pr-1">
            {val}
            <button
              type="button"
              aria-label={`Remove value ${val}`}
              onClick={() => onChange(selectedValues.filter((v) => v !== val))}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => {
            setShowSuggestions(true)
            loadSuggestions()
          }}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (inputValue.trim()) {
                addValue(inputValue)
              }
            }
          }}
          placeholder={`Type a value to match...`}
          className="h-8 text-sm"
        />
        {showSuggestions &&
          (isLoadingSuggestions || filteredSuggestions.length > 0) && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
              <div className="max-h-32 overflow-y-auto p-1">
                {isLoadingSuggestions ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Loading...
                  </p>
                ) : (
                  filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addValue(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
