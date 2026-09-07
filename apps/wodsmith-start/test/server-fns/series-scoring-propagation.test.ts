import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { workouts } from "@/db/schemas/workouts"

const db = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => ({ userId: "user-1" }),
}))
vi.mock("@/utils/team-auth", () => ({ requireTeamPermission: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler:
        (handler: (args: { data: unknown }) => unknown) =>
        (args: { data: unknown }) =>
          handler({ data: validate(args.data) }),
    }),
  }),
}))

import {
  addEventToSeriesTemplateFn,
  copyEventsFromCompetitionFn,
  getCompetitionEventSyncStatusFn,
  getSeriesTemplateEventByIdFn,
  getSeriesTemplateEventsFn,
  previewSyncEventsToCompetitionsFn,
  syncTemplateEventsToCompetitionsFn,
  updateSeriesTemplateEventFn,
} from "@/server-fns/series-event-template-fns"

const group = {
  id: "group-1",
  organizingTeamId: "team-1",
  settings: JSON.stringify({ templateTrackId: "template-track" }),
}
const competition = {
  id: "competition-1",
  organizingTeamId: "team-1",
  name: "Competition",
  groupId: "group-1",
}
const compTrack = { id: "comp-track", competitionId: competition.id }
const definition = {
  id: "template-workout",
  name: "Three efforts",
  description: "Three timed efforts",
  scheme: "time",
  scoreType: "sum",
  timeCap: null,
  roundsToScore: 3,
  tiebreakScheme: "reps",
  repsPerRound: null,
}
const template = {
  id: "template-event",
  trackId: "template-track",
  workoutId: definition.id,
  trackOrder: 1,
  parentEventId: null,
  pointsMultiplier: 100,
  notes: null,
  workout: definition,
  createdAt: new Date(),
  updatedAt: new Date(),
}
const compEvent = {
  ...template,
  id: "comp-event",
  trackId: compTrack.id,
  workoutId: "comp-workout",
  workout: { ...definition, id: "comp-workout" },
}
const mapping = {
  groupId: group.id,
  competitionId: competition.id,
  templateEventId: template.id,
  competitionEventId: compEvent.id,
}

function queueReads(...reads: unknown[][]) {
  const chain = db.getChainMock()
  for (const rows of reads)
    db.select.mockImplementationOnce(() => {
      db.setMockReturnValue(rows)
      return chain
    })
}

function expectScoringProjections() {
  const calls = db.select.mock.calls as unknown as [
    | {
        workout?: {
          scheme?: unknown
          roundsToScore?: unknown
          tiebreakScheme?: unknown
        }
      }
    | undefined,
  ][]
  const fullWorkouts = calls.flatMap(([columns]) =>
    columns?.workout?.scheme ? [columns.workout] : [],
  )
  expect(fullWorkouts.length).toBeGreaterThan(0)
  for (const projection of fullWorkouts) {
    expect(projection.roundsToScore).toBe(workouts.roundsToScore)
    expect(projection.tiebreakScheme).toBe(workouts.tiebreakScheme)
  }
}

describe("series scoring propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.reset()
  })

  // @lat: [[authoring-series-review#Series Authoring Review#Series reads retain scoring definitions]]
  it("returns selected scoring metadata from list and detail reads", async () => {
    queueReads(
      [group],
      [{ id: template.trackId, name: "Template" }],
      [template],
    )
    const list = await getSeriesTemplateEventsFn({
      data: { groupId: group.id },
    })
    expect(list.events[0].workout).toMatchObject({
      roundsToScore: 3,
      tiebreakScheme: "reps",
    })
    queueReads([group], [template], [{ movementId: "thruster" }])
    const detail = await getSeriesTemplateEventByIdFn({
      data: { groupId: group.id, trackWorkoutId: template.id },
    })
    expect(detail.event?.workout).toMatchObject({
      roundsToScore: 3,
      tiebreakScheme: "reps",
    })
    expect(detail.movementIds).toEqual(["thruster"])
    expectScoringProjections()
  })

  // @lat: [[authoring-series-review#Series Authoring Review#Series updates retain scoring definitions]]
  it("persists an edited round count and tiebreak without dropping them from the response", async () => {
    queueReads([group], [template], [template])
    const result = await updateSeriesTemplateEventFn({
      data: {
        groupId: group.id,
        trackWorkoutId: template.id,
        workout: { roundsToScore: 3, tiebreakScheme: "reps" },
      },
    })
    expect(db.getChainMock().set).toHaveBeenCalledWith(
      expect.objectContaining({ roundsToScore: 3, tiebreakScheme: "reps" }),
    )
    expect(result.event.workout).toMatchObject({
      roundsToScore: 3,
      tiebreakScheme: "reps",
    })
    expectScoringProjections()
  })

  // @lat: [[authoring-series-review#Series Authoring Review#Competition copies retain scoring and movements]]
  it("copies scoring and movement links from a competition into its series template", async () => {
    queueReads(
      [group],
      [competition],
      [compTrack],
      [
        {
          id: compEvent.id,
          workoutId: compEvent.workoutId,
          trackOrder: 1,
          parentEventId: null,
          workoutName: definition.name,
          workoutDescription: definition.description,
          workoutScheme: definition.scheme,
          workoutScoreType: definition.scoreType,
          workoutTimeCap: null,
          workoutRoundsToScore: 3,
          workoutTiebreakScheme: "reps",
          workoutRepsPerRound: null,
          pointsMultiplier: 100,
          notes: null,
        },
      ],
      [{ workoutId: compEvent.workoutId, movementId: "thruster" }],
    )
    expect(
      await copyEventsFromCompetitionFn({
        data: { groupId: group.id, sourceCompetitionId: competition.id },
      }),
    ).toEqual({ copiedCount: 1 })
    const values = db.getChainMock().values.mock.calls.map(([value]) => value)
    const created = values.find(
      (value) =>
        !Array.isArray(value) &&
        (value as { name?: string }).name === definition.name,
    ) as { id: string }
    expect(created).toMatchObject({
      roundsToScore: 3,
      tiebreakScheme: "reps",
      scoreType: "sum",
    })
    expect(values).toContainEqual([
      expect.objectContaining({
        workoutId: created.id,
        movementId: "thruster",
      }),
    ])
    const columns = (db.select.mock.calls as unknown as unknown[][])[3][0]
    expect(columns).toMatchObject({
      workoutRoundsToScore: workouts.roundsToScore,
      workoutTiebreakScheme: workouts.tiebreakScheme,
    })
  })

  // @lat: [[authoring-series-review#Series Authoring Review#Every sync path retains scoring]]
  it.each(["mapped", "adopted", "cloned"])(
    "preserves scoring for a %s competition event",
    async (path) => {
      queueReads(
        [group],
        [template],
        path === "mapped" ? [mapping] : [],
        [],
        [],
        [competition],
        [compTrack],
        path === "cloned" ? [] : [compEvent],
      )
      if (path === "mapped") queueReads([compEvent])
      queueReads([{ movementId: "thruster" }], [], [])
      expect(
        await syncTemplateEventsToCompetitionsFn({
          data: { groupId: group.id, competitionIds: [competition.id] },
        }),
      ).toEqual({ synced: 1 })
      if (path === "cloned") {
        expect(db.getChainMock().values).toHaveBeenCalledWith(
          expect.objectContaining({
            name: definition.name,
            roundsToScore: 3,
            tiebreakScheme: "reps",
            scoreType: "sum",
          }),
        )
      } else {
        expect(db.getChainMock().set).toHaveBeenCalledWith(
          expect.objectContaining({
            roundsToScore: 3,
            tiebreakScheme: "reps",
            scoreType: "sum",
          }),
        )
      }
      expect(db.getChainMock().values).toHaveBeenCalledWith([
        expect.objectContaining({ movementId: "thruster" }),
      ])
      expectScoringProjections()
    },
  )

  // @lat: [[authoring-series-review#Series Authoring Review#Scoring changes are visible before sync]]
  it("shows pending rounds and tiebreak changes in previews and sync status", async () => {
    const oldEvent = {
      ...compEvent,
      workout: { ...compEvent.workout, roundsToScore: 1, tiebreakScheme: null },
    }
    queueReads(
      [group],
      [template],
      [mapping],
      [competition],
      [compTrack],
      [oldEvent],
      [],
      [],
      [],
    )
    const preview = await previewSyncEventsToCompetitionsFn({
      data: { groupId: group.id },
    })
    expect(preview.competitions[0].events[0].changes).toEqual(
      expect.arrayContaining([
        "roundsToScore: 1 → 3",
        "tiebreakScheme: none → reps",
      ]),
    )
    queueReads(
      [group],
      [competition],
      [],
      [template],
      [mapping],
      [compTrack],
      [oldEvent],
      [],
      [],
      [],
    )
    const status = await getCompetitionEventSyncStatusFn({
      data: { groupId: group.id },
    })
    expect(status.competitions[0]).toMatchObject({
      status: "behind",
      eventStatuses: [expect.objectContaining({ status: "will-resync" })],
    })
    expectScoringProjections()
  })

  // @lat: [[authoring-series-review#Series Authoring Review#Unknown movement selections reject before writes]]
  it("rejects unknown movement IDs before creating any records", async () => {
    queueReads([group], [{ id: "thruster" }])
    await expect(
      addEventToSeriesTemplateFn({
        data: {
          groupId: group.id,
          trackId: template.trackId,
          workout: { name: "Invalid movement" },
          movementIds: ["thruster", "unknown"],
        },
      }),
    ).rejects.toThrow("Select existing catalog movements")
    expect(db.transaction).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })
})
