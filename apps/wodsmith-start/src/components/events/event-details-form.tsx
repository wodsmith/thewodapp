"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import {
  AddTestDialog,
  type TestDraft,
} from "@/components/benchmark-tiers/test-editor-dialogs"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { WorkoutDefinitionFields } from "@/components/workouts/workout-definition-fields"
import type { Movement, Sponsor } from "@/db/schema"
import type { ScoreType, WorkoutScheme } from "@/db/schemas/workouts"
import {
  SCORE_TYPE_VALUES,
  TIEBREAK_SCHEME_VALUES,
  WORKOUT_SCHEME_VALUES,
} from "@/db/schemas/workouts"
import { benchmarkVariantSchema } from "@/schemas/benchmark.schema"
import { createBenchmarkTestFn } from "@/server-fns/benchmark-scoring-tier-fns"
import { saveCompetitionEventFn } from "@/server-fns/competition-workouts-fns"
import type { EventDivisionMappingData } from "@/server-fns/event-division-mapping-fns"

// Form ID for external submit buttons
export const EVENT_DETAILS_FORM_ID = "event-details-form"

// Form schema
const competitionEventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  scheme: z.enum(WORKOUT_SCHEME_VALUES, "Scheme is required"),
  scoreType: z.enum(SCORE_TYPE_VALUES).nullable(),
  roundsToScore: z.number().min(1).nullable(),
  tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable(),
  timeCap: z.number().min(1).nullable(), // Time cap in seconds
  selectedMovements: z.array(z.string()),
  pointsMultiplier: z.number().min(1).max(1000),
  notes: z.string(),
  divisionDescs: z.record(z.string(), z.string()),
  sponsorId: z.string().nullable(), // "Presented by" sponsor
  benchmarkTestId: z.string().nullable(), // Benchmark test link (benchmark competitions)
})

type CompetitionEventSchema = z.infer<typeof competitionEventSchema>

interface Division {
  id: string
  label: string
  position: number
  registrationCount: number
}

interface DivisionDescriptionData {
  divisionId: string
  divisionLabel: string
  description: string | null
}

interface CompetitionWorkout {
  id: string
  trackId: string
  workoutId: string
  trackOrder: number
  parentEventId: string | null
  notes: string | null
  pointsMultiplier: number | null
  sponsorId: string | null
  benchmarkTestId?: string | null
  workout: {
    id: string
    name: string
    description: string | null
    scheme: WorkoutScheme
    scoreType: ScoreType | null
    roundsToScore: number | null
    tiebreakScheme: string | null
    timeCap: number | null
    // Simplified movement type from server function
    movements?: Array<{ id: string; name: string; type: string }>
  }
}

interface EventDetailsFormOverrides {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFn?: (args: { data: any }) => ReturnType<typeof saveCompetitionEventFn>
}

export interface BenchmarkTestLinkOption {
  id: string
  name: string
  categoryKey: string
  categoryLabel: string
  linkedTrackWorkoutId: string | null
  linkedEventName: string | null
}

interface EventDetailsFormProps {
  event: CompetitionWorkout
  competitionId: string
  organizingTeamId: string
  divisions: Division[]
  divisionDescriptions: DivisionDescriptionData[]
  movements: Movement[]
  sponsors: Sponsor[]
  isParentEvent?: boolean
  formId?: string
  /** Override mutation fns (e.g. cohost equivalents) */
  overrides?: EventDetailsFormOverrides
  /** Base route prefix for navigation links (defaults to "/compete/organizer") */
  routePrefix?: string
  eventDivisionMappings?: EventDivisionMappingData
  /**
   * Benchmark tests available for linking (benchmark competitions only).
   * When provided, shows the benchmark test selector and includes the link
   * in the save payload.
   */
  benchmarkTests?: BenchmarkTestLinkOption[]
  /** Battery config enabling inline "Add event tiers" creation */
  benchmarkBattery?: {
    maxTier: number
    categories: { key: string; label: string }[]
  } | null
}

export function EventDetailsForm({
  event,
  competitionId,
  organizingTeamId,
  divisions,
  divisionDescriptions,
  movements,
  sponsors,
  isParentEvent = false,
  formId = EVENT_DETAILS_FORM_ID,
  overrides,
  routePrefix = "/compete/organizer",
  eventDivisionMappings,
  benchmarkTests,
  benchmarkBattery,
}: EventDetailsFormProps) {
  const router = useRouter()
  const navigate = useNavigate()
  const saveFn = overrides?.saveFn ?? saveCompetitionEventFn

  // Filter divisions to only those mapped to this event (if mappings exist).
  // Sub-events inherit their parent's mappings.
  const variationDivisions = (() => {
    if (!eventDivisionMappings?.hasMappings) return divisions
    const lookupId = event.parentEventId ?? event.id
    const mappedDivisionIds = new Set(
      eventDivisionMappings.mappings
        .filter((m) => m.trackWorkoutId === lookupId)
        .map((m) => m.divisionId),
    )
    // If this event (or its parent) has no explicit mappings, show all divisions
    if (mappedDivisionIds.size === 0) return divisions
    return divisions.filter((d) => mappedDivisionIds.has(d.id))
  })()

  // Build initial division descriptions
  const initialDivisionDescs: Record<string, string> = {}
  for (const dd of divisionDescriptions) {
    initialDivisionDescs[dd.divisionId] = dd.description || ""
  }

  // Initialize form with React Hook Form
  const form = useForm<CompetitionEventSchema>({
    resolver: standardSchemaResolver(competitionEventSchema),
    mode: "onChange",
    defaultValues: {
      name: event.workout.name,
      description: event.workout.description || "",
      scheme: event.workout.scheme,
      scoreType: event.workout.scoreType,
      roundsToScore: event.workout.roundsToScore,
      tiebreakScheme: event.workout.tiebreakScheme as any,
      timeCap: event.workout.timeCap,
      pointsMultiplier: event.pointsMultiplier || 100,
      notes: event.notes || "",
      selectedMovements: event.workout.movements?.map((m) => m.id) ?? [],
      divisionDescs: initialDivisionDescs,
      sponsorId: event.sponsorId,
      benchmarkTestId: event.benchmarkTestId ?? null,
    },
  })

  const { watch, setValue } = form
  const scheme = watch("scheme")
  const scoreType = watch("scoreType")
  const [isSaving, setIsSaving] = useState(false)

  // Inline "Add event tiers": creates the benchmark test already linked to
  // this event server-side, then syncs the select so a later save re-sends
  // the same link instead of clearing it.
  const handleCreateBenchmarkTest = async (test: TestDraft) => {
    const { testId } = await createBenchmarkTestFn({
      data: {
        competitionId,
        test,
        linkTrackWorkoutId: event.id,
      },
    })
    setValue("benchmarkTestId", testId)
    toast.success("Event tiers created")
    await router.invalidate()
  }

  const onSubmit = async (data: CompetitionEventSchema) => {
    setIsSaving(true)
    try {
      // Build division descriptions array
      const divisionDescriptions = divisions.map((division) => ({
        divisionId: division.id,
        description: data.divisionDescs[division.id]?.trim() || null,
      }))

      // Call server function
      await saveFn({
        data: {
          trackWorkoutId: event.id,
          workoutId: event.workoutId,
          teamId: organizingTeamId,
          name: data.name,
          description: data.description,
          scheme: data.scheme,
          scoreType: data.scoreType,
          roundsToScore: data.roundsToScore,
          tiebreakScheme: data.tiebreakScheme,
          timeCap: data.timeCap,
          movementIds: data.selectedMovements,
          pointsMultiplier: data.pointsMultiplier,
          notes: data.notes || null,
          divisionDescriptions:
            divisionDescriptions.length > 0 ? divisionDescriptions : undefined,
          sponsorId: data.sponsorId,
          // Only send the benchmark link when the selector is rendered, so
          // saves from non-benchmark contexts never clear an existing link
          ...(benchmarkTests !== undefined
            ? { benchmarkTestId: data.benchmarkTestId }
            : {}),
        },
      })

      toast.success("Event updated")

      // Invalidate router cache so data is fresh
      await router.invalidate()
    } catch (error) {
      console.error("Failed to save event:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to save event",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Basic Details */}
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
                <CardDescription>
                  Basic information about this event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <WorkoutDefinitionFields
                  value={{
                    ...watch(),
                    timeCapSeconds: watch("timeCap"),
                    movementIds: watch("selectedMovements"),
                    roundsToScore: watch("roundsToScore") ?? undefined,
                  }}
                  onChange={(patch) => {
                    const options = { shouldDirty: true, shouldValidate: true }
                    if (patch.name !== undefined)
                      setValue("name", patch.name, options)
                    if (patch.description !== undefined)
                      setValue("description", patch.description, options)
                    if (patch.scheme !== undefined)
                      setValue("scheme", patch.scheme, options)
                    if (patch.scoreType !== undefined)
                      setValue("scoreType", patch.scoreType, options)
                    if ("roundsToScore" in patch)
                      setValue(
                        "roundsToScore",
                        patch.roundsToScore ?? null,
                        options,
                      )
                    if (patch.timeCapSeconds !== undefined)
                      setValue("timeCap", patch.timeCapSeconds, options)
                    if (patch.tiebreakScheme !== undefined)
                      setValue("tiebreakScheme", patch.tiebreakScheme, options)
                    if (patch.movementIds !== undefined)
                      setValue("selectedMovements", patch.movementIds, options)
                  }}
                  nameLabel="Event Name"
                  descriptionHint={
                    isParentEvent
                      ? "Overall description for the parent event. Individual scored events have their own workout details."
                      : "Default description shown to athletes. Add division-specific variations below."
                  }
                  movements={movements}
                  disabled={isSaving}
                  fields={
                    isParentEvent
                      ? ["name", "description"]
                      : [
                          "name",
                          "scheme",
                          "scoreType",
                          "roundsToScore",
                          "timeCapSeconds",
                          "tiebreakScheme",
                          "description",
                          "movementIds",
                        ]
                  }
                  errors={{
                    name: form.formState.errors.name?.message,
                    scheme: form.formState.errors.scheme?.message,
                    scoreType: form.formState.errors.scoreType?.message,
                    roundsToScore: form.formState.errors.roundsToScore?.message,
                    timeCapSeconds: form.formState.errors.timeCap?.message,
                    description: form.formState.errors.description?.message,
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Competition Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Competition Settings</CardTitle>
                <CardDescription>
                  Settings specific to this competition event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isParentEvent && (
                  <FormField
                    control={form.control}
                    name="pointsMultiplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Points Multiplier</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              className="w-24"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">
                            % (100 = normal, 200 = 2x points)
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!isParentEvent && benchmarkTests !== undefined && (
                  <FormField
                    control={form.control}
                    name="benchmarkTestId"
                    render={({ field }) => {
                      const testsByCategory = new Map<
                        string,
                        BenchmarkTestLinkOption[]
                      >()
                      for (const test of benchmarkTests) {
                        const group =
                          testsByCategory.get(test.categoryLabel) ?? []
                        group.push(test)
                        testsByCategory.set(test.categoryLabel, group)
                      }
                      return (
                        <FormItem>
                          <FormLabel>Benchmark test</FormLabel>
                          <Select
                            value={field.value ?? "none"}
                            onValueChange={(v) =>
                              field.onChange(v === "none" ? null : v)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a benchmark test" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Not linked</SelectItem>
                              {[...testsByCategory.entries()].map(
                                ([categoryLabel, tests]) => (
                                  <SelectGroup key={categoryLabel}>
                                    <SelectLabel>{categoryLabel}</SelectLabel>
                                    {tests.map((test) => {
                                      const linkedElsewhere =
                                        test.linkedTrackWorkoutId !== null &&
                                        test.linkedTrackWorkoutId !== event.id
                                      return (
                                        <SelectItem
                                          key={test.id}
                                          value={test.id}
                                          disabled={linkedElsewhere}
                                        >
                                          {test.name}
                                          {linkedElsewhere
                                            ? ` (linked to ${test.linkedEventName})`
                                            : ""}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectGroup>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {benchmarkTests.length === 0
                              ? "No benchmark tests yet. Add event tiers to create one for this event."
                              : "Links this event to a benchmark test so scores get its category and tier thresholds on the leaderboard."}
                          </FormDescription>
                          {field.value === null &&
                            benchmarkBattery &&
                            benchmarkBattery.categories.length > 0 && (
                              <AddTestDialog
                                categories={benchmarkBattery.categories}
                                maxTier={benchmarkBattery.maxTier}
                                variants={[...benchmarkVariantSchema.options]}
                                events={[
                                  {
                                    id: event.id,
                                    name: event.workout.name,
                                    linkedTestName: null,
                                    scheme,
                                    scoreType,
                                  },
                                ]}
                                defaultEventId={event.id}
                                lockEvent
                                onCreate={handleCreateBenchmarkTest}
                              />
                            )}
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                )}

                <FormField
                  control={form.control}
                  name="sponsorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Presented by</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) =>
                          field.onChange(v === "none" ? null : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a sponsor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No sponsor</SelectItem>
                          {sponsors.map((sponsor) => (
                            <SelectItem key={sponsor.id} value={sponsor.id}>
                              {sponsor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Assign a sponsor to this event for &quot;Presented
                        by&quot; branding
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organizer Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes (not shown to athletes)..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        These notes are only visible to competition organizers.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Division-Specific Descriptions */}
            {!isParentEvent && (
              <Card>
                <CardHeader>
                  <CardTitle>Division Variations</CardTitle>
                  <CardDescription>
                    {variationDivisions.length > 0
                      ? "Customize the workout description for each division. Leave empty to use the default description above."
                      : divisions.length > 0
                        ? "No divisions are mapped to this event. Configure event-division mappings to add variations."
                        : "Create divisions for this competition to add division-specific workout variations."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {variationDivisions.length > 0 ? (
                    variationDivisions
                      .sort((a, b) => a.position - b.position)
                      .map((division) => (
                        <FormField
                          key={division.id}
                          control={form.control}
                          name={`divisionDescs.${division.id}`}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>
                                  {division.label}
                                  {division.registrationCount > 0 && (
                                    <span className="text-muted-foreground ml-2 font-normal">
                                      ({division.registrationCount} athlete
                                      {division.registrationCount !== 1
                                        ? "s"
                                        : ""}
                                      )
                                    </span>
                                  )}
                                </FormLabel>
                                <span className="text-xs text-muted-foreground">
                                  {field.value?.trim()
                                    ? "Custom"
                                    : "Using default"}
                                </span>
                              </div>
                              <FormControl>
                                <Textarea
                                  placeholder={`Custom description for ${division.label}... (leave empty to use default)`}
                                  rows={4}
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))
                  ) : divisions.length > 0 ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        No divisions are mapped to this event.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-4">
                        No divisions have been created for this competition yet.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          navigate({
                            to: `${routePrefix}/$competitionId/divisions`,
                            params: { competitionId },
                          })
                        }
                      >
                        Create divisions
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate({
                to: `${routePrefix}/$competitionId/events`,
                params: { competitionId },
              })
            }
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !form.formState.isValid}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
