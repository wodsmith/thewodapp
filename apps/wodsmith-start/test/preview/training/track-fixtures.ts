import type { TrainingProviderDay, TrainingContext } from "@/lib/training/types"
import type { TrackDetailData } from "@/components/track-detail-view"
export const providerDays: TrainingProviderDay[] = [
  {
    id: "preview-rest",
    date: "2026-09-06",
    kind: "rest",
    url: "https://www.crossfit.com/260906",
    markdown: "**Rest Day**\n\nRecovery and community stories.",
    workouts: [],
  },
  {
    id: "preview-work",
    date: "2026-09-04",
    kind: "workout",
    url: "https://www.crossfit.com/260904",
    markdown:
      "For time:\n21-15-9 reps of:\nThrusters\nPull-ups\n\nThen find your best load over 3 sets of back squats.\n\n**Scaling**\nReduce the load and use assisted pull-ups.",
    workouts: [
      {
        workoutId: "preview-time",
        name: "Timed workout",
        scheme: "time-with-cap",
        description: "21-15-9 thrusters and pull-ups",
        scoreType: "min",
        timeCap: 180,
        roundsToScore: 1,
      },
      {
        workoutId: "preview-load",
        name: "Back squat",
        scheme: "load",
        description: "3 sets",
        scoreType: "max",
        roundsToScore: 3,
        timeCap: null,
      },
    ],
  },
]
export const previewContext: TrainingContext = {
  userId: "preview-athlete",
  activeTeamId: "preview-personal",
  teams: [
    {
      id: "preview-personal",
      name: "My training",
      timezone: "America/Boise",
      isPersonal: true,
      canProgram: false,
      tracks: [
        {
          id: "ptrk_crossfit_dotcom",
          name: "CrossFit.com",
          description: "Daily programming from CrossFit.com",
        },
      ],
    },
  ],
}
export let followState = {
  personalTeamId: "preview-personal",
  following: true,
  trainingAvailable: true,
  gyms: [
    {
      id: "preview-gym",
      name: "CrossFit Fullerton · Community training and coaching",
      added: false,
    },
  ],
}
export function trackData(date: string, admin: boolean): TrackDetailData {
  return {
    track: {
      id: "ptrk_crossfit_dotcom",
      name: "CrossFit.com",
      description: "Daily programming from CrossFit.com",
      type: "official_3rd_party",
      ownerTeamId: "source",
      isPublic: 1,
      scalingGroupId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerTeam: null,
    } as TrackDetailData["track"],
    date,
    canManageImports: admin,
    state: followState,
    days: providerDays as TrackDetailData["days"],
    selected: providerDays.filter(
      (day) => day.date === date,
    ) as TrackDetailData["days"],
    workouts: [
      {
        id: "legacy",
        trackOrder: 5,
        workout: {
          id: "legacy-workout",
          name: "**Chipper Workout**",
          description: "An older workout from the library",
          scheme: "time",
        },
      },
    ] as TrackDetailData["workouts"],
  }
}
export async function followTrackFn({
  data,
}: {
  data: { following: boolean }
}) {
  followState = { ...followState, following: data.following }
  return { teamId: "preview-personal" }
}
export async function addTrackToGymFn() {
  followState = {
    ...followState,
    gyms: followState.gyms.map((gym) => ({ ...gym, added: true })),
  }
  return { teamId: "preview-gym" }
}
export async function getTrackFollowStateFn() {
  return followState
}
export async function getCrossFitImportsFn() {
  return [
    {
      id: "preview-import",
      sourceDate: "2026-09-06",
      status: "published",
      kind: "rest",
      error: null,
      sourceMarkdown: "Rest Day",
      publishedAt: new Date("2026-09-06T13:00:00Z"),
    },
  ]
}
let runDate = "2026-09-04"
let runMode = "dry-run"
export async function runCrossFitImportFn({
  data,
}: {
  data: { sourceDate: string; mode: string }
}) {
  runDate = data.sourceDate
  runMode = data.mode
  return { id: "crossfit-preview-fixture" }
}
export async function getCrossFitRunStatusFn() {
  const source = providerDays.find((day) => day.date === runDate)
  if (runMode === "dry-run" && !source) {
    return {
      status: "errored",
      error: "No preview fixture exists for this date.",
      output: "null",
    }
  }
  return {
    status: "complete",
    error: null,
    output: JSON.stringify(
      runMode === "dry-run"
        ? {
            status: "dry-run",
            date: runDate,
            source: {
              hash: "a".repeat(64),
              markdown: source?.markdown ?? "",
            },
            normalized:
              source?.kind === "rest"
                ? { kind: "rest", components: [] }
                : {
                    kind: "workout",
                    components: [
                      {
                        scheme: "time-with-cap",
                        scoreType: "min",
                        timeCap: 180,
                        roundsToScore: 1,
                        evidence: "For time",
                      },
                      {
                        scheme: "load",
                        scoreType: "max",
                        timeCap: null,
                        roundsToScore: 3,
                        evidence: "3 sets",
                      },
                    ],
                  },
          }
        : { status: "published" },
    ),
  }
}
