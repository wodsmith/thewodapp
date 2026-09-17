import {
  type CrossFitMovement,
  convertCrossFitSource,
} from "@/server/crossfit-converter"
import {
  fetchCrossFitSource,
  parseCrossFitResponse,
} from "@/lib/crossfit/source"

const movementCatalog: CrossFitMovement[] = [
  ["mov_snatch", "snatch", "weightlifting"],
  ["mov_clean", "clean", "weightlifting"],
  ["mov_jerk", "jerk", "weightlifting"],
  ["mov_cleanjerk", "clean and jerk", "weightlifting"],
  ["mov_powersnatch", "power snatch", "weightlifting"],
  ["mov_powerclean", "power clean", "weightlifting"],
  ["mov_pushpress", "push press", "weightlifting"],
  ["mov_press", "press", "weightlifting"],
  ["mov_pushjerk", "push jerk", "weightlifting"],
  ["mov_splitjerk", "split jerk", "weightlifting"],
  ["mov_thruster", "thruster", "weightlifting"],
  ["mov_frontsquat", "front squat", "weightlifting"],
  ["mov_backsquat", "back squat", "weightlifting"],
  ["mov_ohsquat", "overhead squat", "weightlifting"],
  ["mov_deadlift", "deadlift", "weightlifting"],
  ["mov_sdhp", "sumo deadlift high pull", "weightlifting"],
  ["mov_benchpress", "bench press", "weightlifting"],
  ["mov_wallball", "wall ball", "weightlifting"],
  ["mov_kbswing", "kettlebell swing", "weightlifting"],
  ["mov_dbsnatch", "dumbbell snatch", "weightlifting"],
  ["mov_pushup", "push up", "gymnastic"],
  ["mov_hspu", "handstand push up", "gymnastic"],
  ["mov_pullup", "pull up", "gymnastic"],
  ["mov_ctbpullup", "chest to bar pull up", "gymnastic"],
  ["mov_muscleup", "muscle up", "gymnastic"],
  ["mov_ringmuscleup", "ring muscle up", "gymnastic"],
  ["mov_toestobar", "toes to bar", "gymnastic"],
  ["mov_knees_to_elbows", "knees to elbows", "gymnastic"],
  ["mov_situp", "sit up", "gymnastic"],
  ["mov_burpee", "burpee", "gymnastic"],
  ["mov_boxjump", "box jump", "gymnastic"],
  ["mov_airsquat", "air squat", "gymnastic"],
  ["mov_lunge", "lunge", "gymnastic"],
  ["mov_pistol", "pistol", "gymnastic"],
  ["mov_ropeclimb", "rope climb", "gymnastic"],
  ["mov_handstandwalk", "handstand walk", "gymnastic"],
  ["mov_ringdip", "ring dip", "gymnastic"],
  ["mov_jumpingjack", "jumping jack", "gymnastic"],
  ["mov_run", "run", "monostructural"],
  ["mov_row", "row", "monostructural"],
  ["mov_bike", "bike", "monostructural"],
  ["mov_doubleunder", "double under", "monostructural"],
  ["mov_singleunder", "single under", "monostructural"],
  ["mov_skierg", "ski erg", "monostructural"],
  ["mov_assaultbike", "assault bike", "monostructural"],
].map(([id, name, type]) => ({
  id,
  name,
  type: type as CrossFitMovement["type"],
}))

type ExpectedEvent = {
  scheme: string
  timeCap?: number | null
  roundsToScore?: number
  movements: string[]
}

type EvaluationCase = {
  name: string
  markdown: string
  expected: "rest" | "review" | ExpectedEvent[]
}

const cases: EvaluationCase[] = [
  { name: "rest day", markdown: "**Rest Day**", expected: "rest" },
  {
    name: "specific movements and prescribed loads",
    markdown:
      "For time:\n21 power snatches, 95/65 lb\n21 push presses, 95/65 lb\n21 sumo deadlift high pulls, 95/65 lb\n21 front squats, 95/65 lb\n\nPost time to comments.",
    expected: [
      {
        scheme: "time",
        movements: [
          "mov_frontsquat",
          "mov_powersnatch",
          "mov_pushpress",
          "mov_sdhp",
        ],
      },
    ],
  },
  {
    name: "fixed-window reps with an uncataloged movement",
    markdown:
      "Complete as many reps as possible in 12 minutes of:\n2 wall walks\n2 legless rope climbs\n\nAdd 1 wall walk every round.\n\nPost reps to comments.",
    expected: [{ scheme: "reps", movements: ["mov_ropeclimb"] }],
  },
  {
    name: "repeated lifting scores",
    markdown:
      "Front squat 3-3-3-3-3-3-3 reps\n\nPost loads to comments.",
    expected: [
      {
        scheme: "load",
        roundsToScore: 7,
        movements: ["mov_frontsquat"],
      },
    ],
  },
  {
    name: "phase window cap",
    markdown:
      "On a 20-minute clock:\n\nFrom 0:00-10:00, for time:\nRun 1,600 meters\n\n10:00-20:00:\nBuild to a 5-rep-max bench press\n\nPost time and load to comments.",
    expected: [
      { scheme: "time-with-cap", timeCap: 600, movements: ["mov_run"] },
      { scheme: "load", movements: ["mov_benchpress"] },
    ],
  },
  {
    name: "headed parts and transition clock",
    markdown:
      "Part A\nOn a 15-minute clock, for time:\n10 shuttle runs\n15 clean and jerks\n\nPart B\nAt 15 minutes, on a 3-minute clock:\nBuild to a 1-rep-max clean and jerk\n\nPost time and heaviest lift to comments.",
    expected: [
      {
        scheme: "time-with-cap",
        timeCap: 900,
        movements: ["mov_cleanjerk", "mov_run"],
      },
      { scheme: "load", movements: ["mov_cleanjerk"] },
    ],
  },
  {
    name: "multiple pull-up progressions",
    markdown:
      "AMRAP 15:\n20 walking lunges\n15 pull-ups\n10 chest-to-bar pull-ups\n5 muscle-ups\n\nPost rounds and reps to comments.",
    expected: [
      {
        scheme: "rounds-reps",
        movements: [
          "mov_ctbpullup",
          "mov_lunge",
          "mov_muscleup",
          "mov_pullup",
        ],
      },
    ],
  },
  {
    name: "distance target is not a distance score",
    markdown: "For time:\nRow 2,000 meters\n\nPost time to comments.",
    expected: [{ scheme: "time", movements: ["mov_row"] }],
  },
  {
    name: "two scores from one indivisible effort",
    markdown:
      "For time:\n30 clean and jerks\n\nPost time and heaviest successful load to comments.",
    expected: "review",
  },
]

function sameValues(actual: readonly string[], expected: readonly string[]) {
  return [...actual].sort().join("|") === [...expected].sort().join("|")
}

const apiKey = process.env.TYPESAFE_API_KEY
if (!apiKey) throw new Error("TYPESAFE_API_KEY is required")

const datesArgument = process.argv
  .find((argument) => argument.startsWith("--dates="))
  ?.slice("--dates=".length)
if (datesArgument) {
  let failures = 0
  const dates = datesArgument.split(",").filter(Boolean)
  for (const date of dates) {
    try {
      const source = await fetchCrossFitSource(date)
      const result = await convertCrossFitSource(source, movementCatalog, {
        TYPESAFE_API_KEY: apiKey,
      })
      console.log(
        JSON.stringify({
          date,
          passed: true,
          normalized: result.normalized,
          decisions: result.decisions,
          tokens: result.tokens,
        }),
      )
    } catch (error) {
      failures++
      console.log(
        JSON.stringify({
          date,
          passed: false,
          review: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }
  console.log(JSON.stringify({ dates: dates.length, failures }))
  if (failures) process.exitCode = 1
} else {
  let failures = 0
  const caseFilter = process.argv
    .find((argument) => argument.startsWith("--case="))
    ?.slice("--case=".length)
  const selectedCases = caseFilter
    ? cases.filter((evaluation) =>
        evaluation.name.toLowerCase().includes(caseFilter.toLowerCase()),
      )
    : cases
  if (selectedCases.length === 0)
    throw new Error(`No evaluation case matched ${caseFilter}`)

  for (const [index, evaluation] of selectedCases.entries()) {
    const date = `2026-08-${String(index + 1).padStart(2, "0")}`
    const source = await parseCrossFitResponse(
      {
        wods: {
          id: `eval-${index + 1}`,
          cleanID: date.replaceAll("-", ""),
          url: `/${date.replaceAll("-", "").slice(2)}`,
          language: "en",
          publishingState: "published",
          wodRaw: evaluation.markdown,
          modified: "2026-08-01T00:00:00Z",
        },
      },
      date,
    )
    try {
      const result = await convertCrossFitSource(source, movementCatalog, {
        TYPESAFE_API_KEY: apiKey,
      })
      const events =
        result.normalized.kind === "rest"
          ? []
          : result.normalized.structure === "single"
            ? [
                {
                  scheme: result.normalized.score.scheme,
                  timeCap: result.normalized.score.timeCap,
                  roundsToScore: result.normalized.score.roundsToScore,
                  movements: result.normalized.movementIds,
                },
              ]
            : result.normalized.subEvents.map((event) => ({
                scheme: event.score.scheme,
                timeCap: event.score.timeCap,
                roundsToScore: event.score.roundsToScore,
                movements: event.movementIds,
              }))
      const passed =
        evaluation.expected === "rest"
          ? result.normalized.kind === "rest"
          : evaluation.expected === "review"
            ? false
            : evaluation.expected.length === events.length &&
              evaluation.expected.every(
                (expected, eventIndex) =>
                  expected.scheme === events[eventIndex]?.scheme &&
                  (expected.timeCap === undefined ||
                    expected.timeCap === events[eventIndex]?.timeCap) &&
                  (expected.roundsToScore === undefined ||
                    expected.roundsToScore ===
                      events[eventIndex]?.roundsToScore) &&
                  sameValues(
                    events[eventIndex]?.movements ?? [],
                    expected.movements,
                  ),
              )
      if (!passed) failures++
      console.log(
        JSON.stringify({
          case: evaluation.name,
          passed,
          events,
          decisions: result.decisions,
          tokens: result.tokens,
        }),
      )
    } catch (error) {
      const passed = evaluation.expected === "review"
      if (!passed) failures++
      console.log(
        JSON.stringify({
          case: evaluation.name,
          passed,
          review: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }

  console.log(JSON.stringify({ cases: selectedCases.length, failures }))
  if (failures) process.exitCode = 1
}
