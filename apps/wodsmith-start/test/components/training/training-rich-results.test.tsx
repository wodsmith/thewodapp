import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AthletePersonalSession } from "@/components/training/athlete-personal-session"
import { AthleteSessionBlock } from "@/components/training/athlete-session-block"
import { AthleteTeamResults } from "@/components/training/athlete-team-results"
import { TrainingResultDialog } from "@/components/training/training-result-dialog"
import type { OwnTrainingResult, TrainingBlock, TrainingSession, TrainingTeam, TrainingWorkoutScoreInput } from "@/lib/training/types"
import { normalizeTrainingWorkoutResult } from "@/lib/training/workout-scoring"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import { saveTrainingResultFn } from "@/server-fns/training-fns"
import { getPersonalTrainingWorkoutOptionsFn, getPersonalTrainingDayFn, savePersonalTrainingResultFn, savePersonalTrainingSessionFn } from "@/server-fns/training-personal-fns"
vi.mock("@/server-fns/training-fns", () => ({ saveTrainingResultFn: vi.fn(), getTrainingWeekFn: vi.fn(), setTrainingCheerFn: vi.fn() }))
vi.mock("@/server-fns/training-personal-fns", () => ({ getPersonalTrainingWorkoutOptionsFn: vi.fn().mockResolvedValue({ movements: [], scalingGroups: [] }), getPersonalTrainingDayFn: vi.fn(), savePersonalTrainingResultFn: vi.fn(), savePersonalTrainingSessionFn: vi.fn(), getTrainingLibraryWorkoutFn: vi.fn() }))
beforeEach(() => { vi.mocked(getPersonalTrainingWorkoutOptionsFn).mockResolvedValue({ movements: [], scalingGroups: [] }) })
afterEach(cleanup)
const workout: NormalizedWorkoutSave = { name: "Repeatable efforts", description: "Three rounds, rest between efforts", scheme: "time-with-cap", scoreType: "sum", roundsToScore: 3, timeCapSeconds: 300, repsPerRound: null, tiebreakScheme: "reps", scalingGroupId: null, movementIds: [], scope: "private" }
const block: TrainingBlock = { id: "rich", kind: "workout", workout, title: workout.name, prescription: workout.description, coachGuidance: "", scalingGuidance: "" }
const session: TrainingSession = { id: "session", teamId: "gym", trackId: "track", trainingDate: "2026-09-07", timezone: "America/Boise", revision: 1, publishedVersion: 1, draft: null, published: { title: "Training", coachNote: "", isRestDay: false, blocks: [block] } }
const team: TrainingTeam = { id: "gym", name: "Test gym", timezone: "America/Boise", canProgram: false, tracks: [{ id: "track", name: "Daily", description: null }] }
function saved(input: TrainingWorkoutScoreInput, definition = workout, id = "my-result"): OwnTrainingResult {
 return { id, sessionId: session.id, blockId: block.id, publishedVersion: 1, userId: id, userName: id, trainingDate: session.trainingDate, trackId: "track", block: { ...block, workout: definition }, ...normalizeTrainingWorkoutResult(definition, input), scaling: "rx", modification: "", audience: "private", unit: input.unit, completed: true, cheerCount: 0, hasCheered: false, notes: "A useful private note" }
}

describe("rich training workout scores", () => {
 // @lat: [[training#Rich Workout Interface Tests#Capped rounds reopen exactly]]
 it("preserves mixed capped rounds and tiebreaks when reopening, failing, and retrying", async () => {
  const input: TrainingWorkoutScoreInput = { score: "", unit: "lb", roundScores: [{ score: "4:12.345", status: "scored", secondaryScore: "" }, { score: "", status: "cap", secondaryScore: "75" }, { score: "4:50", status: "scored", secondaryScore: "" }], tiebreakScore: "12" }
  const result = saved(input)
  vi.mocked(saveTrainingResultFn).mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce(result)
  render(<TrainingResultDialog session={session} block={block} trackName="Daily" gymName="Test gym" result={result} onSaved={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
  expect(screen.getByLabelText("Round 1 time")).toHaveValue("4:12.345")
  expect(screen.getByLabelText("Round 2 capped")).toBeChecked()
  expect(screen.getByLabelText("Round 2 time")).toBeDisabled()
  expect(screen.getByLabelText("Round 2 reps completed")).toHaveValue(75)
  expect(screen.getByLabelText("Tiebreak reps")).toHaveValue("12")
  fireEvent.click(screen.getByRole("button", { name: "Save result" }))
  await screen.findByText("Connection interrupted")
  expect(screen.getByLabelText("Round 2 reps completed")).toHaveValue(75)
  fireEvent.click(screen.getByRole("button", { name: "Save result" }))
  await waitFor(() => expect(saveTrainingResultFn).toHaveBeenLastCalledWith({ data: expect.objectContaining({ sessionId: session.id, blockId: block.id, roundScores: input.roundScores, tiebreakScore: "12", audience: "private" }) }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
 })

 // @lat: [[training#Rich Workout Interface Tests#All schemes use their scoring controls]]
 it("supports rounds/reps, distance, counts, EMOM, and pass/fail without treating them as generic reps", async () => {
  for (const example of [
    { scheme: "rounds-reps" as const, label: "Rounds + Reps", value: "5+12" },
    { scheme: "meters" as const, label: "Meters", value: "1200" },
    { scheme: "feet" as const, label: "Feet", value: "300" },
    { scheme: "calories" as const, label: "Calories", value: "45" },
    { scheme: "points" as const, label: "Points", value: "100" },
    { scheme: "emom" as const, label: "Time", value: "10:00" },
    { scheme: "pass-fail" as const, label: "Result", value: "pass" },
  ]) {
    const definition = { ...workout, scheme: example.scheme, roundsToScore: 1, scoreType: "max" as const, timeCapSeconds: null, tiebreakScheme: null }
    const result = saved({ score: example.value, unit: "lb" }, definition)
    vi.mocked(saveTrainingResultFn).mockResolvedValue(result)
    const { unmount } = render(<TrainingResultDialog session={session} block={{ ...block, workout: definition }} trackName="Daily" gymName="Test gym" onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Log result" }))
    fireEvent.change(screen.getByLabelText(example.label), { target: { value: example.value } })
    fireEvent.click(screen.getByRole("button", { name: "Save result" }))
    await waitFor(() => expect(saveTrainingResultFn).toHaveBeenLastCalledWith({ data: expect.objectContaining({ score: example.value, roundScores: undefined }) }))
    unmount()
  }
  const passDefinition = { ...workout, scheme: "pass-fail" as const, roundsToScore: 1, scoreType: "max" as const, timeCapSeconds: null, tiebreakScheme: null }
  render(<TrainingResultDialog session={session} block={{ ...block, workout: passDefinition }} result={saved({ score: "p", unit: "lb" }, passDefinition)} trackName="Daily" gymName="Test gym" onSaved={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
  expect(screen.getByLabelText("Result")).toHaveValue("pass")
 })

 // @lat: [[training#Rich Workout Interface Tests#Personal scores retain rich inputs]]
 it("forwards all private multi-set load inputs using the chosen unit", async () => {
  const definition = { ...workout, scheme: "load" as const, scoreType: "sum" as const, roundsToScore: 2, timeCapSeconds: null, tiebreakScheme: null }
  const ownedBlock = { ...block, workout: definition }
  const item = { id: "owned", kind: "personal" as const, block: ownedBlock }
  const result = { ...saved({ score: "", unit: "kg", roundScores: [{ score: "100" }, { score: "105" }] }, definition), sessionId: "personal-session", blockId: "owned" }
  vi.mocked(getPersonalTrainingDayFn).mockResolvedValue({ defaultTrackId: "track", selectedTrackId: "track", sourceSession: null, personalSession: { id: "personal-session", teamId: "gym", trainingDate: session.trainingDate, revision: 3, items: [item] }, items: [item], results: [], libraryResults: [] })
  vi.mocked(savePersonalTrainingResultFn).mockResolvedValue(result)
  render(<AthletePersonalSession team={team} trackId="track" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} />)
  await screen.findByRole("heading", { name: workout.name })
  fireEvent.click(screen.getByRole("button", { name: "Log result" }))
  fireEvent.change(screen.getByLabelText("Load unit"), { target: { value: "kg" } })
  fireEvent.change(screen.getByLabelText("Round 1 load"), { target: { value: "100" } })
  fireEvent.change(screen.getByLabelText("Round 2 load"), { target: { value: "105" } })
  expect(screen.queryByLabelText("Who can see this result?")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Save result" }))
  await waitFor(() => expect(savePersonalTrainingResultFn).toHaveBeenCalledWith({ data: expect.objectContaining({ personalSessionId: "personal-session", itemId: "owned", expectedRevision: 3, unit: "kg", roundScores: [{ score: "100", status: "scored", secondaryScore: "" }, { score: "105", status: "scored", secondaryScore: "" }] }) }))
  expect(saveTrainingResultFn).not.toHaveBeenCalled()
 })

 // @lat: [[training#Rich Workout Interface Tests#Personal definitions use canonical fields]]
 it("creates a private canonical workout only after the athlete saves its full definition", async () => {
  const day = { defaultTrackId: "track", selectedTrackId: "track", sourceSession: null, personalSession: null, items: [], results: [], libraryResults: [] }
  vi.mocked(getPersonalTrainingDayFn).mockResolvedValue(day)
  vi.mocked(savePersonalTrainingSessionFn).mockResolvedValue({ id: "personal-session", teamId: "gym", trainingDate: session.trainingDate, revision: 1, items: [] })
  render(<AthletePersonalSession team={team} trackId="track" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Create workout" }))
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  expect(screen.getByLabelText("Workout name")).toHaveAttribute("maxlength", "255")
  fireEvent.change(screen.getByLabelText("Workout name"), { target: { value: "Two intervals" } })
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Row 500m, rest 2 minutes" } })
  fireEvent.change(screen.getByLabelText("Rounds to Score"), { target: { value: "2" } })
  fireEvent.click(screen.getByRole("button", { name: "Save to my session" }))
  await waitFor(() => expect(savePersonalTrainingSessionFn).toHaveBeenCalledWith({ data: expect.objectContaining({ items: [expect.objectContaining({ kind: "personal", block: expect.objectContaining({ kind: "workout", title: "Two intervals", prescription: "Row 500m, rest 2 minutes", workout: { name: "Two intervals", description: "Row 500m, rest 2 minutes", scheme: "time", scoreType: "min", roundsToScore: 2, timeCapSeconds: null, repsPerRound: null, tiebreakScheme: null, scalingGroupId: null, movementIds: [], scope: "private" } }) })] }) }))
 })

 // @lat: [[training#Rich Workout Interface Tests#Team rankings retain caps and tiebreaks]]
 it("ranks complete and capped performances with real tiebreaks, and displays individual rounds", async () => {
  const baseInput = { score: "", unit: "lb" as const, roundScores: [{ score: "4:00", status: "scored" as const }, { score: "", status: "cap" as const, secondaryScore: "75" }, { score: "4:30", status: "scored" as const }] }
  const first = { ...saved({ ...baseInput, tiebreakScore: "20" }, workout, "higher-tiebreak"), audience: "gym" as const }
  const second = { ...saved({ ...baseInput, tiebreakScore: "10" }, workout, "lower-tiebreak"), audience: "gym" as const }
  const finished = { ...saved({ ...baseInput, roundScores: [{ score: "4:00" }, { score: "4:30" }, { score: "4:30" }], tiebreakScore: "0" }, workout, "finished"), audience: "gym" as const }
  render(<AthleteTeamResults session={session} results={[second, first, finished]} userId="me" onCheered={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Show rankings" }))
  const rows = screen.getAllByRole("listitem").filter((row) => row.parentElement?.closest("li") === null)
  expect(within(rows[0]!).getByText("finished")).toBeVisible()
  expect(within(rows[1]!).getByText("higher-tiebreak")).toBeVisible()
  expect(within(rows[2]!).getByText("lower-tiebreak")).toBeVisible()
  fireEvent.click(within(rows[1]!).getByText("Score breakdown"))
  expect(within(rows[1]!).getByText("CAP · 75 reps completed")).toBeVisible()
 })
})

// @lat: [[athlete-workout-review#Verification#Readable score summaries]]
it("describes first and last aggregation and caps without score-entry instructions", () => {
 for (const [scoreType, label] of [["first", "First recorded score"], ["last", "Last recorded score"]] as const) {
  const { unmount } = render(<AthleteSessionBlock session={session} block={{ ...block, workout: { ...workout, scoreType } }} index={0} trackName="Daily" gymName="Test gym" onSaved={vi.fn()} />)
  expect(screen.getByText(new RegExp(`3 scores · ${label} · Time cap: 5:00`))).toBeVisible()
  expect(screen.queryByText(/Enter as/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Log result" }))
  expect(screen.getByText(new RegExp(`3 separately recorded scores · ${label}`))).toBeVisible()
  unmount()
 }
})

// @lat: [[athlete-workout-review#Verification#Capped reps validate before saving]]
it("focuses missing capped reps before saving and accepts zero", async () => {
 const definition = { ...workout, roundsToScore: 1, tiebreakScheme: null }
 vi.mocked(saveTrainingResultFn).mockResolvedValue(saved({ score: "", unit: "lb", status: "cap", secondaryScore: "0" }, definition))
 render(<TrainingResultDialog session={session} block={{ ...block, workout: definition }} trackName="Daily" gymName="Test gym" onSaved={vi.fn()} />)
 fireEvent.click(screen.getByRole("button", { name: "Log result" }))
 fireEvent.click(screen.getByLabelText("Round 1 capped"))
 fireEvent.click(screen.getByRole("button", { name: "Save result" }))
 expect(saveTrainingResultFn).not.toHaveBeenCalled()
 expect(screen.getByRole("alert")).toHaveTextContent("Enter reps completed for round 1, including zero.")
 expect(screen.getByLabelText("Round 1 reps completed")).toHaveFocus()
 fireEvent.change(screen.getByLabelText("Round 1 reps completed"), { target: { value: "0" } })
 fireEvent.click(screen.getByRole("button", { name: "Save result" }))
 await waitFor(() => expect(saveTrainingResultFn).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "cap", secondaryScore: "0" }) }))
})

// @lat: [[athlete-workout-review#Verification#Unscored sections remain available]]
it("adds private completion and instruction sections only on explicit save", async () => {
 for (const kind of ["check", "note"] as const) {
  vi.mocked(savePersonalTrainingSessionFn).mockClear()
  vi.mocked(getPersonalTrainingDayFn).mockResolvedValue({ defaultTrackId: "track", selectedTrackId: "track", sourceSession: null, personalSession: null, items: [], results: [], libraryResults: [] })
  vi.mocked(savePersonalTrainingSessionFn).mockResolvedValue({ id: "personal", teamId: "gym", trainingDate: session.trainingDate, revision: 1, items: [] })
  const { unmount } = render(<AthletePersonalSession team={team} trackId="track" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Add instructions or completion" }))
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Section name"), { target: { value: "Mobility" } })
  fireEvent.change(screen.getByLabelText("Workout"), { target: { value: "Ten minutes of easy stretching" } })
  fireEvent.change(screen.getByLabelText("Record"), { target: { value: kind } })
  fireEvent.click(screen.getByRole("button", { name: "Save to my session" }))
  await waitFor(() => expect(savePersonalTrainingSessionFn).toHaveBeenCalledWith({ data: expect.objectContaining({ items: [expect.objectContaining({ kind: "personal", block: expect.objectContaining({ kind, title: "Mobility" }) })] }) }))
  unmount()
 }
})

// @lat: [[athlete-workout-review#Verification#Athletes assign catalogs with recovery]]
it("retries athlete catalogs without losing edits and saves movements and scaling assignments", async () => {
 vi.mocked(getPersonalTrainingDayFn).mockResolvedValue({ defaultTrackId: "track", selectedTrackId: "track", sourceSession: null, personalSession: null, items: [], results: [], libraryResults: [] })
 vi.mocked(getPersonalTrainingWorkoutOptionsFn).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce({ movements: [{ id: "row", name: "Row", type: "monostructural" }], scalingGroups: [{ id: "gym-levels", title: "Gym levels" }] })
 vi.mocked(savePersonalTrainingSessionFn).mockResolvedValue({ id: "personal", teamId: "gym", trainingDate: session.trainingDate, revision: 1, items: [] })
 render(<AthletePersonalSession team={team} trackId="track" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} />)
 fireEvent.click(await screen.findByRole("button", { name: "Create workout" }))
 fireEvent.change(screen.getByLabelText("Workout name"), { target: { value: "My row" } })
 fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Row 500m" } })
 fireEvent.click(await screen.findByRole("button", { name: "Retry movement and scaling options" }))
 fireEvent.click(await screen.findByRole("button", { name: /Row/i }))
 fireEvent.click(screen.getByRole("combobox", { name: "Scaling group (optional)" }))
 fireEvent.click(await screen.findByRole("option", { name: "Gym levels" }))
 expect(screen.getByLabelText("Workout name")).toHaveValue("My row")
 expect(getPersonalTrainingWorkoutOptionsFn).toHaveBeenLastCalledWith({ data: { teamId: "gym" } })
 fireEvent.click(screen.getByRole("button", { name: "Save to my session" }))
 await waitFor(() => expect(savePersonalTrainingSessionFn).toHaveBeenCalledWith({ data: expect.objectContaining({ items: [expect.objectContaining({ block: expect.objectContaining({ workout: expect.objectContaining({ name: "My row", movementIds: ["row"], scalingGroupId: "gym-levels" }) }) })] }) }))
})
