import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { SCORE_TYPES, TIEBREAK_SCHEMES, WORKOUT_SCHEMES } from "@/constants"
import {
  SCORE_TYPE_VALUES,
  TIEBREAK_SCHEME_VALUES,
  WORKOUT_SCHEME_VALUES,
} from "@/db/schemas/workouts"
import type { ScoreType, WorkoutScheme } from "@/db/schemas/workouts"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"
import {
  getWorkoutDivisionDescriptionsFn,
  updateWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { getSeriesTemplateDivisionsFn } from "@/server-fns/series-division-mapping-fns"
import {
  getSeriesTemplateEventByIdFn,
  updateSeriesTemplateEventFn,
} from "@/server-fns/series-event-template-fns"
import { formatTrackOrder } from "@/utils/format-track-order"

const templateEventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  scheme: z.enum(WORKOUT_SCHEME_VALUES),
  scoreType: z.enum(SCORE_TYPE_VALUES).nullable(),
  timeCap: z.number().min(1).nullable(),
  tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable(),
  pointsMultiplier: z.number().min(1).max(1000),
  notes: z.string(),
  divisionDescs: z.record(z.string(), z.string()),
})

type TemplateEventSchema = z.infer<typeof templateEventSchema>

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId/events/$eventId",
)({
  component: SeriesTemplateEventEditPage,
  loader: async ({ params }) => {
    const [eventResult, groupResult, divisionsResult] = await Promise.all([
      getSeriesTemplateEventByIdFn({
        data: {
          trackWorkoutId: params.eventId,
          groupId: params.groupId,
        },
      }),
      getCompetitionGroupByIdFn({
        data: { groupId: params.groupId },
      }),
      getSeriesTemplateDivisionsFn({
        data: { groupId: params.groupId },
      }).catch(() => ({ scalingGroupId: null, divisions: [] as Array<{ id: string; label: string; teamSize: number }> })),
    ])

    if (!eventResult.event) {
      throw new Error("Event not found")
    }

    const organizingTeamId = groupResult.group?.organizingTeamId ?? ""

    // Load division descriptions
    let divisionDescriptions: Array<{
      divisionId: string
      divisionLabel: string
      description: string | null
      position: number
    }> = []
    const divisionIds = divisionsResult.divisions.map((d) => d.id)
    if (divisionIds.length > 0) {
      const descResult = await getWorkoutDivisionDescriptionsFn({
        data: { workoutId: eventResult.event.workoutId, divisionIds },
      })
      divisionDescriptions = descResult.descriptions
    }

    return {
      event: eventResult.event,
      organizingTeamId,
      divisions: divisionsResult.divisions,
      divisionDescriptions,
    }
  },
})

function SeriesTemplateEventEditPage() {
  const { groupId } = Route.useParams()
  const { event, organizingTeamId, divisions, divisionDescriptions } = Route.useLoaderData()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<TemplateEventSchema>({
    resolver: standardSchemaResolver(templateEventSchema),
    mode: "onChange",
    defaultValues: {
      name: event.workout.name,
      description: event.workout.description || "",
      scheme: (event.workout.scheme || "time") as WorkoutScheme,
      scoreType: (event.workout.scoreType as ScoreType) ?? null,
      timeCap: event.workout.timeCap ?? null,
      tiebreakScheme: null,
      pointsMultiplier: event.pointsMultiplier || 100,
      notes: event.notes || "",
      divisionDescs: Object.fromEntries(
        divisionDescriptions.map((dd) => [dd.divisionId, dd.description || ""]),
      ),
    },
  })

  const { watch } = form
  const scheme = watch("scheme")

  const onSubmit = async (data: TemplateEventSchema) => {
    setIsSaving(true)
    try {
      await updateSeriesTemplateEventFn({
        data: {
          trackWorkoutId: event.id,
          groupId,
          workout: {
            name: data.name,
            description: data.description,
            scheme: data.scheme,
            scoreType: data.scoreType,
            timeCap: data.timeCap,
          },
          pointsMultiplier: data.pointsMultiplier,
          notes: data.notes || null,
        },
      })
      // Save division descriptions
      if (divisions.length > 0 && organizingTeamId) {
        const descriptionsToSave = divisions.map((div) => ({
          divisionId: div.id,
          description: data.divisionDescs[div.id]?.trim() || null,
        }))
        await updateWorkoutDivisionDescriptionsFn({
          data: {
            workoutId: event.workoutId,
            teamId: organizingTeamId,
            descriptions: descriptionsToSave,
          },
        })
      }

      toast.success("Event updated")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save event",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-4">
              <Button variant="ghost" size="sm" asChild>
                <Link
                  to="/compete/organizer/series/$groupId/events"
                  params={{ groupId }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Events
                </Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold">Edit Event</h1>
            <p className="text-muted-foreground mt-1">
              Event #{formatTrackOrder(event.trackOrder)} -{" "}
              {event.workout.name}
            </p>
          </div>
          <Button
            type="submit"
            form="series-event-details-form"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Form */}
        <Form {...form}>
          <form
            id="series-event-details-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Event Details</CardTitle>
                    <CardDescription>
                      Basic information about this template event
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Event 1 - Fran"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="scheme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheme</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select scheme" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {WORKOUT_SCHEMES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="scoreType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Score Type</FormLabel>
                          <Select
                            value={field.value ?? "none"}
                            onValueChange={(v) =>
                              field.onChange(v === "none" ? null : v)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select score type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {SCORE_TYPES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {scheme === "time-with-cap" && (
                      <FormField
                        control={form.control}
                        name="timeCap"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Time Cap (minutes)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g., 12"
                                value={field.value ? field.value / 60 : ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value
                                      ? Math.round(
                                          Number.parseFloat(e.target.value) *
                                            60,
                                        )
                                      : null,
                                  )
                                }
                                min="1"
                                step="0.5"
                              />
                            </FormControl>
                            <FormDescription>
                              Enter time cap in minutes (e.g., 12 for 12:00)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {scheme !== "pass-fail" && (
                      <FormField
                        control={form.control}
                        name="tiebreakScheme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Tiebreak{" "}
                              <span className="text-muted-foreground">
                                (optional)
                              </span>
                            </FormLabel>
                            <Select
                              value={field.value ?? "none"}
                              onValueChange={(v) =>
                                field.onChange(v === "none" ? null : v)
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {TIEBREAK_SCHEMES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Used to break ties when athletes have the same
                              score
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="21-15-9 Thrusters, Pull-ups..."
                              rows={6}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            This is the default description shown to all
                            athletes. Division-specific descriptions can be set
                            on each competition after syncing.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Template Settings</CardTitle>
                    <CardDescription>
                      Settings that will be synced to all competitions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                            These notes are only visible to series organizers.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {divisions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Division Variations</CardTitle>
                      <CardDescription>
                        Customize the workout description for each division.
                        These will be synced to all competitions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {divisions.map((division) => (
                        <FormField
                          key={division.id}
                          control={form.control}
                          name={`divisionDescs.${division.id}`}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>{division.label}</FormLabel>
                                <span className="text-xs text-muted-foreground">
                                  {field.value?.trim() ? "Custom" : "Using default"}
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
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link
                  to="/compete/organizer/series/$groupId/events"
                  params={{ groupId }}
                >
                  Cancel
                </Link>
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !form.formState.isValid}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
