// @lat: [[crew#Judge Rotations]]
import type { FormEvent } from "react"
import {
  createFileRoute,
  getRouteApi,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, RotateCcw, Save, Send, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  LANE_SHIFT_PATTERN,
  type LaneShiftPattern,
} from "@/db/schemas/volunteers"
import {
  expandCrewJudgeRotationDrafts,
  summarizeCrewJudgeCoverage,
  validateCrewJudgeRotationDrafts,
  type CrewJudgeRotationDraft,
  type CrewJudgeRotationHeat,
} from "@/lib/crew/judge-rotations"
import {
  getCrewJudgeRotationsPageFn,
  publishCrewJudgeRotationsFn,
  saveCrewJudgeRotationsForVolunteerFn,
  type CrewJudgeRotationsPageData,
  type CrewJudgeVolunteer,
} from "@/server-fns/crew-judge-rotations-fns"

export const Route = createFileRoute("/events/$eventId/judges")({
  loader: async ({ params }) =>
    await getCrewJudgeRotationsPageFn({
      data: { eventId: params.eventId },
    }),
  component: EventJudgeRotationsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

interface RotationFormRow {
  clientId: string
  startingHeat: number
  startingLane: number
  heatsCount: number
  notes: string
}

function EventJudgeRotationsPage() {
  const { eventId } = parentRoute.useParams()
  const { page } = Route.useLoaderData()
  const search = useSearch({ strict: false }) as {
    workout?: string
    judge?: string
  }
  const navigate = useNavigate()
  const selectedWorkoutId =
    search.workout &&
    page.workouts.some((workout) => workout.id === search.workout)
      ? search.workout
      : page.workouts[0]?.id
  const selectedJudgeId =
    search.judge &&
    page.judges.some((judge) => judge.membershipId === search.judge)
      ? search.judge
      : page.judges[0]?.membershipId
  const selectedWorkout = page.workouts.find(
    (workout) => workout.id === selectedWorkoutId,
  )
  const selectedJudge = page.judges.find(
    (judge) => judge.membershipId === selectedJudgeId,
  )
  const workoutHeats = page.heats.filter(
    (heat) => heat.trackWorkoutId === selectedWorkoutId,
  )
  const workoutRotations = page.rotations.filter(
    (rotation) => rotation.trackWorkoutId === selectedWorkoutId,
  )
  const coverage = summarizeCrewJudgeCoverage({
    heats: workoutHeats,
    rotations: workoutRotations.map(toRotationDraft),
  })
  const activeVersion = selectedWorkoutId
    ? page.activeVersionByWorkout[selectedWorkoutId]
    : null

  function updateSearch(next: { workout?: string; judge?: string }) {
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        ...next,
      }),
      replace: true,
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Judge rotations</h2>
          <p className="text-sm text-muted-foreground">
            {page.judges.length} judges, {page.rotations.length} rotations
          </p>
        </div>
        {selectedWorkoutId ? (
          <PublishRotationsPanel
            eventId={eventId}
            trackWorkoutId={selectedWorkoutId}
            activeVersionLabel={
              activeVersion ? `Version ${activeVersion.version}` : "No version"
            }
          />
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatusPanel label="Judges" value={page.judges.length} />
        <StatusPanel label="Heats" value={workoutHeats.length} />
        <StatusPanel label="Coverage" value={`${coverage.coveragePercent}%`} />
        <StatusPanel
          label="Published"
          value={activeVersion ? `v${activeVersion.version}` : "Draft"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="rounded-md border bg-card p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="judge-workout">Workout</Label>
              <Select
                value={selectedWorkoutId ?? ""}
                onValueChange={(workout) => updateSearch({ workout })}
              >
                <SelectTrigger id="judge-workout">
                  <SelectValue placeholder="Select workout" />
                </SelectTrigger>
                <SelectContent>
                  {page.workouts.map((workout) => (
                    <SelectItem key={workout.id} value={workout.id}>
                      {formatWorkoutLabel(workout)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="judge-volunteer">Judge</Label>
              <Select
                value={selectedJudgeId ?? ""}
                onValueChange={(judge) => updateSearch({ judge })}
              >
                <SelectTrigger id="judge-volunteer">
                  <SelectValue placeholder="Select judge" />
                </SelectTrigger>
                <SelectContent>
                  {page.judges.map((judge) => (
                    <SelectItem
                      key={judge.membershipId}
                      value={judge.membershipId}
                    >
                      {getJudgeName(judge)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="rounded-md border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Active version
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <Fact
              label="Version"
              value={activeVersion ? `v${activeVersion.version}` : "None"}
            />
            <Fact
              label="Published"
              value={
                activeVersion ? formatDateTime(activeVersion.publishedAt) : "No"
              }
            />
            <Fact label="By" value={activeVersion?.publisherName ?? "System"} />
          </div>
        </section>
      </div>

      {page.workouts.length === 0 ? (
        <EmptyState
          title="No workouts"
          body="Add workouts and heats before scheduling judges."
        />
      ) : page.judges.length === 0 ? (
        <EmptyState
          title="No judges"
          body="Add volunteers with judge roles before creating rotations."
        />
      ) : selectedWorkout && selectedJudge ? (
        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <JudgeList
            page={page}
            selectedJudgeId={selectedJudge.membershipId}
            selectedWorkoutId={selectedWorkout.id}
            onSelectJudge={(judge) => updateSearch({ judge })}
          />
          <div className="space-y-6">
            <RotationEditor
              eventId={eventId}
              selectedJudge={selectedJudge}
              selectedWorkoutId={selectedWorkout.id}
              heats={workoutHeats}
              rotations={workoutRotations}
              defaultLaneShiftPattern={
                selectedWorkout.defaultLaneShiftPattern ??
                LANE_SHIFT_PATTERN.SHIFT_RIGHT
              }
            />
            <CoveragePreview
              heats={workoutHeats}
              rotations={workoutRotations}
              judges={page.judges}
              coverageLabel={`${coverage.coveredSlots}/${coverage.totalSlots}`}
            />
            <PublishedAssignments
              assignments={page.activeAssignments.filter(
                (assignment) =>
                  assignment.trackWorkoutId === selectedWorkout.id,
              )}
            />
            <VersionHistory
              versions={page.versionHistoryByWorkout[selectedWorkout.id] ?? []}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function PublishRotationsPanel({
  eventId,
  trackWorkoutId,
  activeVersionLabel,
}: {
  eventId: string
  trackWorkoutId: string
  activeVersionLabel: string
}) {
  const router = useRouter()
  const publishRotations = useServerFn(publishCrewJudgeRotationsFn)
  const [notes, setNotes] = useState("")
  const [isPublishing, setIsPublishing] = useState(false)

  async function handlePublish() {
    setIsPublishing(true)
    try {
      const result = await publishRotations({
        data: {
          eventId,
          trackWorkoutId,
          notes,
        },
      })
      toast.success(`Published judge schedule v${result.version.version}`)
      setNotes("")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish rotations",
      )
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:min-w-80">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{activeVersionLabel}</span>
        <Button type="button" onClick={handlePublish} disabled={isPublishing}>
          <Send />
          Publish
        </Button>
      </div>
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Version notes"
        className="min-h-16"
      />
    </div>
  )
}

function JudgeList({
  page,
  selectedJudgeId,
  selectedWorkoutId,
  onSelectJudge,
}: {
  page: CrewJudgeRotationsPageData
  selectedJudgeId: string
  selectedWorkoutId: string
  onSelectJudge: (judgeId: string) => void
}) {
  return (
    <aside className="space-y-3">
      <h3 className="text-sm font-semibold uppercase text-muted-foreground">
        Judges
      </h3>
      <div className="space-y-2">
        {page.judges.map((judge) => {
          const count = page.rotations.filter(
            (rotation) =>
              rotation.trackWorkoutId === selectedWorkoutId &&
              rotation.membershipId === judge.membershipId,
          ).length
          const selected = judge.membershipId === selectedJudgeId

          return (
            <button
              key={judge.membershipId}
              type="button"
              onClick={() => onSelectJudge(judge.membershipId)}
              className={
                selected
                  ? "w-full rounded-md border bg-muted px-3 py-3 text-left text-sm"
                  : "w-full rounded-md border bg-card px-3 py-3 text-left text-sm hover:bg-muted"
              }
            >
              <span className="block font-medium">{getJudgeName(judge)}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={count > 0 ? "default" : "outline"}>
                  {count}
                </Badge>
                rotations
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function RotationEditor({
  eventId,
  selectedJudge,
  selectedWorkoutId,
  heats,
  rotations,
  defaultLaneShiftPattern,
}: {
  eventId: string
  selectedJudge: CrewJudgeVolunteer
  selectedWorkoutId: string
  heats: CrewJudgeRotationHeat[]
  rotations: CrewJudgeRotationsPageData["rotations"]
  defaultLaneShiftPattern: LaneShiftPattern
}) {
  const router = useRouter()
  const saveRotations = useServerFn(saveCrewJudgeRotationsForVolunteerFn)
  const selectedRotations = useMemo(
    () =>
      rotations.filter(
        (rotation) => rotation.membershipId === selectedJudge.membershipId,
      ),
    [rotations, selectedJudge.membershipId],
  )
  const [laneShiftPattern, setLaneShiftPattern] = useState<LaneShiftPattern>(
    selectedRotations[0]?.laneShiftPattern ?? defaultLaneShiftPattern,
  )
  const [rows, setRows] = useState<RotationFormRow[]>(() =>
    toFormRows(selectedRotations),
  )
  const [isSaving, setIsSaving] = useState(false)
  const otherRotationDrafts = rotations
    .filter((rotation) => rotation.membershipId !== selectedJudge.membershipId)
    .map(toRotationDraft)
  const draftRows = rows.map(
    (row): CrewJudgeRotationDraft => ({
      membershipId: selectedJudge.membershipId,
      startingHeat: row.startingHeat,
      startingLane: row.startingLane,
      heatsCount: row.heatsCount,
      laneShiftPattern,
    }),
  )
  const issues = validateCrewJudgeRotationDrafts({
    heats,
    occupiedSlots: expandCrewJudgeRotationDrafts({
      heats,
      rotations: otherRotationDrafts,
    }),
    rotations: draftRows,
  })
  const errorCount = issues.filter((issue) => issue.severity === "error").length
  const warningCount = issues.length - errorCount

  useEffect(() => {
    setLaneShiftPattern(
      selectedRotations[0]?.laneShiftPattern ?? defaultLaneShiftPattern,
    )
    setRows(toFormRows(selectedRotations))
  }, [defaultLaneShiftPattern, selectedRotations])

  function updateRow(
    clientId: string,
    key: keyof Omit<RotationFormRow, "clientId">,
    value: string | number,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.clientId === clientId ? { ...row, [key]: value } : row,
      ),
    )
  }

  function addRow() {
    const lastRow = rows.at(-1)
    setRows((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        startingHeat: lastRow ? lastRow.startingHeat + lastRow.heatsCount : 1,
        startingLane: lastRow?.startingLane ?? 1,
        heatsCount: 3,
        notes: "",
      },
    ])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    try {
      await saveRotations({
        data: {
          eventId,
          trackWorkoutId: selectedWorkoutId,
          membershipId: selectedJudge.membershipId,
          laneShiftPattern,
          rotations: rows.map((row) => ({
            startingHeat: row.startingHeat,
            startingLane: row.startingLane,
            heatsCount: row.heatsCount,
            notes: row.notes,
          })),
        },
      })
      toast.success("Judge rotations saved")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save rotations",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {getJudgeName(selectedJudge)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {rows.length} rotations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus />
            Add
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows(toFormRows(selectedRotations))}
          >
            <RotateCcw />
            Reset
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save />
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
        <div className="space-y-2">
          <Label htmlFor="lane-shift-pattern">Lane shift</Label>
          <Select
            value={laneShiftPattern}
            onValueChange={(value) =>
              setLaneShiftPattern(value as LaneShiftPattern)
            }
          >
            <SelectTrigger id="lane-shift-pattern">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LANE_SHIFT_PATTERN.STAY}>Stay</SelectItem>
              <SelectItem value={LANE_SHIFT_PATTERN.SHIFT_RIGHT}>
                Shift right
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          {errorCount > 0 ? (
            <Badge variant="destructive">{errorCount} errors</Badge>
          ) : (
            <Badge variant="secondary">Valid</Badge>
          )}
          {warningCount > 0 ? (
            <Badge variant="outline">{warningCount} warnings</Badge>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Start heat</th>
              <th className="px-3 py-2 font-medium">Start lane</th>
              <th className="px-3 py-2 font-medium">Heats</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.clientId} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={1}
                    value={row.startingHeat}
                    onChange={(event) =>
                      updateRow(
                        row.clientId,
                        "startingHeat",
                        normalizePositiveInteger(event.target.value),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={1}
                    value={row.startingLane}
                    onChange={(event) =>
                      updateRow(
                        row.clientId,
                        "startingLane",
                        normalizePositiveInteger(event.target.value),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={1}
                    value={row.heatsCount}
                    onChange={(event) =>
                      updateRow(
                        row.clientId,
                        "heatsCount",
                        normalizePositiveInteger(event.target.value),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.notes}
                    onChange={(event) =>
                      updateRow(row.clientId, "notes", event.target.value)
                    }
                    placeholder="Optional"
                  />
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setRows((current) =>
                        current.filter(
                          (candidate) => candidate.clientId !== row.clientId,
                        ),
                      )
                    }
                    aria-label="Remove rotation"
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No rotations for this judge.
          </div>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <div className="space-y-2 rounded-md border bg-background p-3 text-sm">
          {issues.slice(0, 5).map((issue) => (
            <p
              key={`${issue.type}-${issue.rotationId}-${issue.heatNumber}-${issue.laneNumber}`}
              className={
                issue.severity === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }
            >
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}
    </form>
  )
}

function CoveragePreview({
  heats,
  rotations,
  judges,
  coverageLabel,
}: {
  heats: CrewJudgeRotationHeat[]
  rotations: CrewJudgeRotationsPageData["rotations"]
  judges: CrewJudgeVolunteer[]
  coverageLabel: string
}) {
  const judgeById = new Map(judges.map((judge) => [judge.membershipId, judge]))
  const slots = expandCrewJudgeRotationDrafts({
    heats,
    rotations: rotations.map(toRotationDraft),
  })
  const slotsByHeatLane = new Map<string, typeof slots>()

  for (const slot of slots) {
    const key = `${slot.heatNumber}:${slot.laneNumber}`
    slotsByHeatLane.set(key, [...(slotsByHeatLane.get(key) ?? []), slot])
  }

  return (
    <section className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Coverage preview</h3>
        <Badge variant="secondary">{coverageLabel}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Heat</th>
              <th className="px-3 py-2 font-medium">Lane coverage</th>
            </tr>
          </thead>
          <tbody>
            {heats.map((heat) => (
              <tr key={heat.heatNumber} className="border-b last:border-b-0">
                <td className="whitespace-nowrap px-3 py-3 font-medium">
                  Heat {heat.heatNumber}
                </td>
                <td className="px-3 py-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from(
                      { length: heat.laneCount },
                      (_, index) => index + 1,
                    ).map((laneNumber) => {
                      const laneSlots =
                        slotsByHeatLane.get(
                          `${heat.heatNumber}:${laneNumber}`,
                        ) ?? []
                      return (
                        <div
                          key={laneNumber}
                          className="rounded-md border bg-background px-2 py-2"
                        >
                          <span className="text-xs text-muted-foreground">
                            Lane {laneNumber}
                          </span>
                          <div className="mt-1 min-h-5 font-medium">
                            {laneSlots.length > 0
                              ? laneSlots
                                  .map((slot) =>
                                    getJudgeName(
                                      judgeById.get(slot.membershipId) ?? null,
                                    ),
                                  )
                                  .join(", ")
                              : "Open"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PublishedAssignments({
  assignments,
}: {
  assignments: CrewJudgeRotationsPageData["activeAssignments"]
}) {
  return (
    <section className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
      <h3 className="text-lg font-semibold">Published assignments</h3>
      {assignments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Heat</th>
                <th className="px-3 py-2 font-medium">Lane</th>
                <th className="px-3 py-2 font-medium">Judge</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">Heat {assignment.heatNumber}</td>
                  <td className="px-3 py-2">
                    {assignment.laneNumber ?? "Any"}
                  </td>
                  <td className="px-3 py-2">
                    {getJudgeName(assignment.volunteer)}
                  </td>
                  <td className="px-3 py-2">
                    {assignment.isManualOverride ? "Manual" : "Rotation"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No published judge assignments for this workout.
        </p>
      )}
    </section>
  )
}

function VersionHistory({
  versions,
}: {
  versions: CrewJudgeRotationsPageData["versionHistoryByWorkout"][string]
}) {
  return (
    <section className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
      <h3 className="text-lg font-semibold">Version history</h3>
      {versions.length > 0 ? (
        <div className="divide-y rounded-md border">
          {versions.map((version) => (
            <div
              key={version.id}
              className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[6rem_1fr_10rem]"
            >
              <div className="font-medium">v{version.version}</div>
              <div className="text-muted-foreground">
                {version.notes || "No notes"}
              </div>
              <div className="text-muted-foreground">
                {formatDateTime(version.publishedAt)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No judge schedule has been published for this workout.
        </p>
      )}
    </section>
  )
}

function StatusPanel({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-md border bg-card p-8 text-center shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </section>
  )
}

function toFormRows(
  rotations: CrewJudgeRotationsPageData["rotations"],
): RotationFormRow[] {
  return rotations.map((rotation) => ({
    clientId: rotation.id,
    startingHeat: rotation.startingHeat,
    startingLane: rotation.startingLane,
    heatsCount: rotation.heatsCount,
    notes: rotation.notes ?? "",
  }))
}

function toRotationDraft(
  rotation: Pick<
    CrewJudgeRotationsPageData["rotations"][number],
    | "id"
    | "membershipId"
    | "startingHeat"
    | "startingLane"
    | "heatsCount"
    | "laneShiftPattern"
  >,
): CrewJudgeRotationDraft {
  return {
    id: rotation.id,
    membershipId: rotation.membershipId,
    startingHeat: rotation.startingHeat,
    startingLane: rotation.startingLane,
    heatsCount: rotation.heatsCount,
    laneShiftPattern: rotation.laneShiftPattern,
  }
}

function getJudgeName(judge: CrewJudgeVolunteer | null | undefined) {
  if (!judge) return "Unknown judge"
  return (
    [judge.firstName, judge.lastName].filter(Boolean).join(" ") ||
    judge.email ||
    judge.membershipId
  )
}

function formatWorkoutLabel(
  workout: CrewJudgeRotationsPageData["workouts"][number],
) {
  return `Event ${workout.trackOrder}: ${workout.workout.name}`
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function normalizePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}
