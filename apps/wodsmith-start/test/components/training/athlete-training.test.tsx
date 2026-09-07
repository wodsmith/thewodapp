vi.mock("@/components/workout-import/workout-import-entry", () => ({ WorkoutImportEntry: () => null }))
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AthleteTraining } from "@/components/training/athlete-training"
import { AthleteSessionBlock } from "@/components/training/athlete-session-block"
import { AthleteTeamResults } from "@/components/training/athlete-team-results"
import { TrainingResultDialog } from "@/components/training/training-result-dialog"
import { AthletePersonalSession } from "@/components/training/athlete-personal-session"
import { getPersonalTrainingDayFn, getPersonalTrainingHistoryFn, savePersonalTrainingResultFn, saveTrainingPreferenceFn, savePersonalTrainingSessionFn, getTrainingLibraryWorkoutFn } from "@/server-fns/training-personal-fns"
import { parseTime } from "@/lib/scoring/parse/time"
import type { OwnTrainingResult, TrainingBlock, TrainingContext, TrainingSession, TrainingWeek } from "@/lib/training/types"
import { getTrainingHistoryFn, getTrainingWeekFn, saveTrainingResultFn, setTrainingCheerFn } from "@/server-fns/training-fns"

vi.mock("@tanstack/react-router", async (actual) => ({...await actual<object>(), Link: ({children,params}:{children:React.ReactNode;params:{workoutId:string}})=><a href={`/workouts/${params.workoutId}`}>{children}</a>}))

vi.mock("@/server-fns/training-fns", () => ({
  getTrainingWeekFn: vi.fn(),
  getTrainingHistoryFn: vi.fn(),
  saveTrainingResultFn: vi.fn(),
  setTrainingCheerFn: vi.fn(),
}))

vi.mock("@/server-fns/training-personal-fns", () => ({ getPersonalTrainingDayFn: vi.fn(), getPersonalTrainingHistoryFn: vi.fn(), saveTrainingPreferenceFn: vi.fn(), savePersonalTrainingSessionFn: vi.fn(), savePersonalTrainingResultFn: vi.fn(), getTrainingLibraryWorkoutFn: vi.fn() }))
vi.mock("@/components/training/earlier-training-history", () => ({ EarlierTrainingHistory: () => <p>Library and earlier results</p> }))
const block: TrainingBlock = { id: "squat", kind: "load", title: "Back squat", prescription: "Build to a heavy set of five.", scalingGuidance: "Choose a load you control.", coachGuidance: "" }
const session: TrainingSession = { id: "session-mon", teamId: "gym", trackId: "everyday", trainingDate: "2026-09-07", timezone: "America/Boise", revision: 2, publishedVersion: 2, draft: null, published: { title: "Strength for the week", coachNote: "Keep each rep smooth.", isRestDay: false, blocks: [block] } }
const context: TrainingContext = { userId: "me", activeTeamId: "gym", teams: [{ id: "gym", name: "Test gym", timezone: "America/Boise", canProgram: false, tracks: [{ id: "everyday", name: "Everyday", description: null }, { id: "compete", name: "Compete", description: null }] }, { id: "other", name: "Other gym", timezone: "Pacific/Auckland", canProgram: false, tracks: [{ id: "other-track", name: "Other plan", description: null }] }] }
const result: OwnTrainingResult = { id: "result-me", sessionId: session.id, blockId: block.id, publishedVersion: 2, userId: "me", userName: "Me", trainingDate: session.trainingDate, trackId: session.trackId, block, scoreValue: 102058, displayScore: "225", scaling: "rx", modification: "", audience: "private", unit: "lb", completed: true, cheerCount: 0, hasCheered: false, notes: "Private memory" }
const emptyWeek: TrainingWeek = { sessions: [], myResults: [], teamResults: [] }

beforeEach(() => {
  localStorage.clear()
  vi.mocked(getPersonalTrainingHistoryFn).mockResolvedValue([])
  vi.mocked(getPersonalTrainingDayFn).mockImplementation(async (options) => {
    const data = options?.data as { trackId?: string; trainingDate: string }
    const selected = data.trackId ?? "everyday"
    const source = data.trainingDate === session.trainingDate ? { ...session, trackId: selected, published: { ...session.published!, title: selected === "compete" ? "Compete day" : session.published!.title } } : null
    return { defaultTrackId: "everyday", selectedTrackId: selected, sourceSession: source, personalSession: null, results: [], libraryResults: [], items: source ? [{ id: "source-squat", kind: "source", block, trackId: selected, trackName: selected, sourceTrainingDate: source.trainingDate, sourceSessionId: source.id, sourceBlockId: block.id, sourcePublishedVersion: source.publishedVersion }] : [] }
  })
  vi.mocked(saveTrainingPreferenceFn).mockResolvedValue(undefined)
  vi.mocked(getTrainingLibraryWorkoutFn).mockResolvedValue({ id: "fran", name: "Fran", description: "21-15-9 thrusters and pull-ups", scheme: "time", scoreType: "min", roundsToScore: 1, timeCap: null, repsPerRound: null, tiebreakScheme: null, scalingGroupId: null })
  vi.mocked(getTrainingWeekFn).mockResolvedValue({ sessions: [session], myResults: [], teamResults: [] })
  vi.mocked(getTrainingHistoryFn).mockResolvedValue([])
  vi.mocked(saveTrainingResultFn).mockResolvedValue(result)
  vi.mocked(setTrainingCheerFn).mockResolvedValue({ success: true })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("athlete training", () => {
  // @lat: [[training#Athlete Interface Tests#Failed result saves retain context]]
  it("keeps input and scheduled identity after a failed save, then returns focus on success", async () => {
    vi.mocked(saveTrainingResultFn).mockRejectedValueOnce(new Error("Connection interrupted. Try again."))
    const onSaved = vi.fn()
    render(<TrainingResultDialog session={session} block={block} trackName="Everyday" gymName="Test gym" onSaved={onSaved} />)
    const trigger = screen.getByRole("button", { name: "Log result" })
    fireEvent.click(trigger)
    expect(screen.getByText("Test gym · Everyday · 2026-09-07 · America/Boise · Version 2")).toBeVisible()
    fireEvent.change(screen.getByLabelText("Load"), { target: { value: "225" } })
    fireEvent.change(screen.getByLabelText("Private notes"), { target: { value: "Keep this private" } })
    fireEvent.click(screen.getByRole("button", { name: "Save result" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted")
    expect(screen.getByLabelText("Load")).toHaveValue(225)
    expect(screen.getByLabelText("Private notes")).toHaveValue("Keep this private")
    expect(onSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save result" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(result))
    expect(saveTrainingResultFn).toHaveBeenLastCalledWith({ data: expect.objectContaining({ sessionId: "session-mon", blockId: "squat", publishedVersion: 2, score: "225", unit: "lb", audience: "private", notes: "Keep this private" }) })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  // @lat: [[training#Athlete Interface Tests#Section saves are coordinated]]
  it("blocks competing completion and notes saves, then clears an earlier completion error", async () => {
    const checkBlock: TrainingBlock = { ...block, kind: "check", title: "Warm-up" }
    const savedCheck: OwnTrainingResult = { ...result, block: checkBlock, scoreValue: null, displayScore: "Completed" }
    let rejectCompletion: (error: Error) => void = () => {}
    let resolveNotes: (value: OwnTrainingResult) => void = () => {}
    vi.mocked(saveTrainingResultFn)
      .mockImplementationOnce(() => new Promise<OwnTrainingResult>((_resolve, reject) => { rejectCompletion = reject }))
      .mockImplementationOnce(() => new Promise<OwnTrainingResult>((resolve) => { resolveNotes = resolve }))
    const onSaved = vi.fn()
    render(<ol><AthleteSessionBlock session={session} block={checkBlock} index={0} trackName="Everyday" gymName="Test gym" onSaved={onSaved} /></ol>)
    const completionButton = screen.getByRole("button", { name: "Mark complete" })
    const notesButton = screen.getByRole("button", { name: "Add notes" })
    fireEvent.click(completionButton)
    expect(completionButton).toBeDisabled()
    expect(notesButton).toBeDisabled()
    fireEvent.click(notesButton)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(saveTrainingResultFn).toHaveBeenCalledTimes(1)
    await act(async () => { rejectCompletion(new Error("Completion could not be saved")) })
    expect(await screen.findByRole("alert")).toHaveTextContent("Completion could not be saved")
    fireEvent.click(notesButton)
    fireEvent.change(screen.getByLabelText("Private notes"), { target: { value: "Warm-up complete" } })
    fireEvent.click(screen.getByRole("button", { name: "Save result" }))
    expect(completionButton).toBeDisabled()
    fireEvent.click(completionButton)
    expect(saveTrainingResultFn).toHaveBeenCalledTimes(2)
    await act(async () => { resolveNotes(savedCheck) })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(onSaved).toHaveBeenCalledWith(savedCheck)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(completionButton).toBeEnabled()
  })

  // @lat: [[training#Athlete Interface Tests#Dismissed result edits are discarded]]
  it("discards dismissed edits and reopens from the latest saved result", async () => {
    const { rerender } = render(<TrainingResultDialog session={session} block={block} trackName="Everyday" gymName="Test gym" result={result} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
    fireEvent.change(screen.getByLabelText("Load"), { target: { value: "300" } })
    fireEvent.change(screen.getByLabelText("Private notes"), { target: { value: "Unsaved note" } })
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(saveTrainingResultFn).not.toHaveBeenCalled()
    rerender(<TrainingResultDialog session={session} block={block} trackName="Everyday" gymName="Test gym" result={{ ...result, displayScore: "245", notes: "Latest saved note" }} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
    expect(screen.getByLabelText("Load")).toHaveValue(245)
    expect(screen.getByLabelText("Private notes")).toHaveValue("Latest saved note")
    fireEvent.change(screen.getByLabelText("Load"), { target: { value: "275" } })
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
    expect(screen.getByLabelText("Load")).toHaveValue(245)
  })

  // @lat: [[training#Athlete Interface Tests#Encoded scores edit in display units]]
  it("edits load and time using display units instead of stored grams or milliseconds", async () => {
    const { unmount } = render(<TrainingResultDialog session={session} block={block} trackName="Everyday" gymName="Test gym" result={result} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
    expect(screen.getByLabelText("Load")).toHaveValue(225)
    expect(screen.getByLabelText("Load unit")).toHaveValue("lb")
    unmount()
    const timeBlock = { ...block, kind: "time" as const }
    for (const duration of [
      { displayScore: "12:34", scoreValue: 754000, minutes: 12, seconds: 34, submittedScore: "12:34" },
      { displayScore: "1:02:34", scoreValue: 3754000, minutes: 62, seconds: 34, submittedScore: "62:34" },
      { displayScore: "2:00:04", scoreValue: 7204000, minutes: 120, seconds: 4, submittedScore: "120:04" },
      { displayScore: "1:02:34.567", scoreValue: 3754567, minutes: 62, seconds: 34.567, submittedScore: "62:34.567" },
      { displayScore: "1:00:59.999", scoreValue: 3659999, minutes: 60, seconds: 59.999, submittedScore: "60:59.999" },
    ]) {
      const { unmount: unmountTime } = render(<TrainingResultDialog session={session} block={timeBlock} trackName="Everyday" gymName="Test gym" result={{ ...result, block: timeBlock, displayScore: duration.displayScore, scoreValue: duration.scoreValue }} onSaved={vi.fn()} />)
      fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
      expect(screen.getByLabelText("Minutes")).toHaveValue(duration.minutes)
      expect(screen.getByLabelText("Seconds")).toHaveValue(duration.seconds)
      expect(screen.getByLabelText("Seconds")).toBeValid()
      fireEvent.click(screen.getByRole("button", { name: "Save result" }))
      await waitFor(() => expect(saveTrainingResultFn).toHaveBeenLastCalledWith({ data: expect.objectContaining({ score: duration.submittedScore }) }))
      expect(parseTime(duration.submittedScore).encoded).toBe(duration.scoreValue)
      unmountTime()
    }
  })

  // @lat: [[training#Athlete Interface Tests#Calendar preserves gym local dates]]
  it("uses the gym's day at the UTC boundary and keeps the date while switching tracks", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-08T02:00:00Z"))
    render(<AthleteTraining context={context} />)
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-07")
    await screen.findByRole("heading", { name: "Strength for the week" })
    fireEvent.change(screen.getByLabelText("Choose training date"), { target: { value: "2026-09-09" } })
    fireEvent.change(screen.getByLabelText("Training track"), { target: { value: "compete" } })
    await waitFor(() => expect(getTrainingWeekFn).toHaveBeenLastCalledWith({ data: { teamId: "gym", trackId: "compete", startDate: "2026-09-07", mode: "athlete" } }))
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-09")
    expect(saveTrainingPreferenceFn).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-16")
    fireEvent.change(screen.getByLabelText("Training for"), { target: { value: "other" } })
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-08")
    await screen.findByText("No session is published for this day. You can still build your own.")
  })

  // @lat: [[training#Athlete Interface Tests#Track switching rejects stale responses]]
  it("does not display an old track request that resolves after the new track", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-07T16:00:00Z"))
    let resolveOld: (week: TrainingWeek) => void = () => {}
    vi.mocked(getTrainingWeekFn).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve })).mockResolvedValueOnce({ ...emptyWeek, sessions: [{ ...session, id: "compete-session", trackId: "compete", published: { ...session.published!, title: "Compete day" } }] })
    render(<AthleteTraining context={context} />)
    await waitFor(() => expect(screen.getByLabelText("Training track")).toBeEnabled())
    await waitFor(() => expect(getTrainingWeekFn).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Training track"), { target: { value: "compete" } })
    await screen.findByRole("heading", { name: "Compete day" })
    await act(async () => { resolveOld({ ...emptyWeek, sessions: [session] }) })
    expect(screen.queryByRole("heading", { name: "Strength for the week" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Compete day" })).toBeVisible()
  })

  // @lat: [[training#Athlete Interface Tests#Team results isolate comparable scores]]
  it("isolates session/version/section/unit and keeps modified results unranked while saving encouragement", async () => {
    const peer = { ...result, id: "peer", userId: "peer", userName: "Current peer", audience: "gym" as const }
    const onCheered = vi.fn()
    render(<AthleteTeamResults session={session} userId="me" onCheered={onCheered} results={[peer, { ...peer, id: "old", userName: "Earlier version", publishedVersion: 1 }, { ...peer, id: "kg", userName: "Kilogram peer", unit: "kg" }, { ...peer, id: "other", userName: "Other section", blockId: "other" }, { ...peer, id: "custom", userName: "Modified peer", scaling: "custom" }]} />)
    expect(screen.getByText("Current peer")).toBeVisible()
    expect(screen.queryByText("Earlier version")).not.toBeInTheDocument()
    expect(screen.queryByText("Kilogram peer")).not.toBeInTheDocument()
    expect(screen.queryByText("Other section")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Encourage Current peer; 0 cheers" }))
    await waitFor(() => expect(onCheered).toHaveBeenCalledWith("peer", true))
    expect(setTrainingCheerFn).toHaveBeenCalledWith({ data: { resultId: "peer", cheered: true } })
    fireEvent.change(screen.getByLabelText("Scaling"), { target: { value: "custom" } })
    expect(screen.getByText("Modified peer")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Show rankings" })).not.toBeInTheDocument()
  })

  // @lat: [[training#Athlete Interface Tests#History preserves earlier prescriptions]]
  it("shows an old published prescription and private notes in personal history", async () => {
    vi.mocked(getTrainingHistoryFn).mockResolvedValue([{ ...result, publishedVersion: 1, block: { ...block, prescription: "Earlier prescription: three sets of five." } }])
    render(<AthleteTraining context={context} initialView="progress" />)
    await screen.findByRole("heading", { name: "Back squat" })
    expect(screen.getByText(/Version 1/)).toBeVisible()
    fireEvent.click(screen.getByText("Prescription and notes"))
    const history = screen.getByRole("region", { name: "Your work, remembered." })
    expect(within(history).getByText("Earlier prescription: three sets of five.")).toBeVisible()
    expect(within(history).getByText("Private memory", { exact: false })).toBeVisible()
    expect(within(history).getByText("Library and earlier results")).toBeVisible()
  })
})

// @lat: [[training#Athlete Interface Tests#Default track is explicit]]
it("opens the durable default without saving a personal session and keeps browsing separate", async () => {
  render(<AthleteTraining context={context} initialDate={session.trainingDate} />)
  await screen.findByRole("heading", { name: "Strength for the week" })
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Training track"), { target: { value: "compete" } })
  await screen.findByRole("heading", { name: "Compete day" })
  expect(saveTrainingPreferenceFn).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Make default track" }))
  await waitFor(() => expect(saveTrainingPreferenceFn).toHaveBeenCalledWith({ data: { teamId: "gym", defaultTrackId: "compete" } }))
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
})

// @lat: [[training#Athlete Interface Tests#Composition creates personal ownership lazily]]
it("creates a personal composition only when a workout is removed", async () => {
  render(<AthletePersonalSession team={context.teams[0]!} trackId="everyday" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} />)
  await screen.findByRole("heading", { name: "Back squat" })
  fireEvent.click(screen.getByRole("button", { name: "Customize session" }))
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Remove" }))
  await waitFor(() => expect(savePersonalTrainingSessionFn).toHaveBeenCalledWith({ data: { teamId: "gym", trainingDate: session.trainingDate, expectedRevision: 0, items: [] } }))
})

// @lat: [[training#Athlete Interface Tests#Remixes preserve references until saved]]
it("keeps source ownership until an explicit remix is saved and retains failed edits", async () => {
  vi.mocked(savePersonalTrainingSessionFn).mockRejectedValue(new Error("Save interrupted. Try again."))
  render(<AthletePersonalSession team={context.teams[0]!} trackId="everyday" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} />)
  await screen.findByRole("heading", { name: "Back squat" })
  fireEvent.click(screen.getByRole("button", { name: "Customize session" }))
  fireEvent.click(screen.getByRole("button", { name: "Remix to edit" }))
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Workout"), { target: { value: "Three easy sets" } })
  fireEvent.click(screen.getByRole("button", { name: "Save to my session" }))
  await screen.findByText("Save interrupted. Try again.")
  expect(screen.getByLabelText("Workout")).toHaveValue("Three easy sets")
  expect(savePersonalTrainingSessionFn).toHaveBeenLastCalledWith({ data: expect.objectContaining({ items: [expect.objectContaining({ kind: "personal", block: expect.objectContaining({ prescription: "Three easy sets" }), remixedFrom: { sourceSessionId: session.id, sourceBlockId: block.id, sourcePublishedVersion: 2 } })] }) })
})

// @lat: [[training#Athlete Interface Tests#Library additions require confirmation]]
it("previews a library link without creating a session until confirmed", async () => {
  render(<AthletePersonalSession team={context.teams[0]!} trackId="everyday" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} libraryWorkoutId="fran" />)
  await screen.findByRole("heading", { name: "Add Fran?" })
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Add to my session" }))
  await waitFor(() => expect(savePersonalTrainingSessionFn).toHaveBeenCalledWith({ data: expect.objectContaining({ items: [expect.objectContaining({ kind: "source" }), expect.objectContaining({ kind: "library", workoutId: "fran" })] }) }))
})

// @lat: [[training#Athlete Interface Tests#Moved workouts log on the performed date]]
it("logs a workout borrowed from another date privately without updating its original occurrence", async () => {
 const targetDate = "2026-09-08"
 const item = { id: "moved-squat", kind: "source" as const, block, trackId: session.trackId, trackName: "Everyday", sourceTrainingDate: session.trainingDate, sourceSessionId: session.id, sourceBlockId: block.id, sourcePublishedVersion: session.publishedVersion, sourceIsCurrent: true }
 vi.mocked(getPersonalTrainingDayFn).mockResolvedValue({ defaultTrackId: "everyday", selectedTrackId: "everyday", sourceSession: null, personalSession: { id: "personal-tuesday", teamId: "gym", trainingDate: targetDate, revision: 1, items: [item] }, items: [item], results: [], libraryResults: [] })
 vi.mocked(savePersonalTrainingResultFn).mockResolvedValue({ ...result, id: "moved-result", sessionId: "personal-tuesday", blockId: item.id, trainingDate: targetDate, audience: "private" })
 render(<AthletePersonalSession team={context.teams[0]!} trackId="everyday" date={targetDate} sourceResults={[result]} onSaved={vi.fn()} />)
 await screen.findByRole("heading", { name: "Back squat" })
 fireEvent.click(screen.getByRole("button", { name: "Log result" }))
 expect(screen.queryByLabelText("Who can see this result?")).not.toBeInTheDocument()
 fireEvent.change(screen.getByLabelText("Load"), { target: { value: "185" } })
 fireEvent.click(screen.getByRole("button", { name: "Save result" }))
 await waitFor(() => expect(savePersonalTrainingResultFn).toHaveBeenCalledWith({ data: expect.objectContaining({ personalSessionId: "personal-tuesday", itemId: "moved-squat", expectedRevision: 1, score: "185" }) }))
 expect(saveTrainingResultFn).not.toHaveBeenCalled()
})

// @lat: [[training#Athlete Interface Tests#Published updates preserve composed source results]]
it("keeps the exact saved source score visible and read-only after a coach republishes", async () => {
  const item = { id: "saved-source", kind: "source" as const, block, trackId: session.trackId, trackName: "Everyday", sourceTrainingDate: session.trainingDate, sourceSessionId: session.id, sourceBlockId: block.id, sourcePublishedVersion: session.publishedVersion, sourceIsCurrent: false }
  vi.mocked(getPersonalTrainingDayFn).mockResolvedValue({ defaultTrackId: "everyday", selectedTrackId: "everyday", sourceSession: { ...session, publishedVersion: 3 }, personalSession: { id: "my-composition", teamId: "gym", trainingDate: session.trainingDate, revision: 1, items: [item] }, items: [item], results: [result], libraryResults: [] })
  render(<AthletePersonalSession team={context.teams[0]!} trackId="everyday" date={session.trainingDate} sourceResults={[{ ...result, id: "new-version", publishedVersion: 3, displayScore: "300" }]} onSaved={vi.fn()} />)
  await screen.findByRole("heading", { name: "Back squat" })
  expect(screen.getByText("225 lb", { exact: false })).toBeVisible()
  expect(screen.queryByText("300 lb", { exact: false })).not.toBeInTheDocument()
  expect(screen.getByText(/Saved against an earlier published version/)).toBeVisible()
  expect(screen.queryByRole("button", { name: "Log result" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit result" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByText("Private notes"))
  expect(screen.getByText("Private memory")).toBeVisible()
  expect(saveTrainingResultFn).not.toHaveBeenCalled()
  expect(savePersonalTrainingResultFn).not.toHaveBeenCalled()
})

// @lat: [[training#Athlete Interface Tests#Cancelled library requests stay dismissed]]
it("clears a cancelled library deep link and does not reopen it when the date changes", async () => {
  window.history.replaceState({ test: "preserve" }, "", `/training?teamId=gym&date=${session.trainingDate}&workoutId=fran`)
  render(<AthleteTraining context={context} initialDate={session.trainingDate} libraryWorkoutId="fran" />)
  await screen.findByRole("heading", { name: "Add Fran?" })
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(new URL(window.location.href).searchParams.has("workoutId")).toBe(false)
  expect(window.history.state).toEqual({ test: "preserve" })
  fireEvent.change(screen.getByLabelText("Choose training date"), { target: { value: "2026-09-08" } })
  await screen.findByText("No session is published for this day. You can still build your own.")
  expect(screen.queryByRole("heading", { name: "Add Fran?" })).not.toBeInTheDocument()
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
})

// @lat: [[training#Athlete Interface Tests#Personal titles match server limits]]
it("limits personal workout names to the server-supported length", async () => {
  render(<AthletePersonalSession team={context.teams[0]!} trackId="everyday" date={session.trainingDate} sourceResults={[]} onSaved={vi.fn()} />)
  await screen.findByRole("heading", { name: "Back squat" })
  fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
  expect(screen.getByLabelText("Workout name")).toHaveAttribute("maxlength", "160")
})

// @lat: [[training#Provider Verification#Explicit track deep links]]
it("opens an explicit track without changing the saved default", async () => {
  render(
    <AthleteTraining
      context={context}
      initialDate="2026-09-07"
      initialTrackId="compete"
    />,
  )
  await waitFor(() =>
    expect(getPersonalTrainingDayFn).toHaveBeenCalledWith({
      data: { teamId: "gym", trainingDate: "2026-09-07", trackId: "compete" },
    }),
  )
  expect(saveTrainingPreferenceFn).not.toHaveBeenCalled()
})

// @lat: [[training-personal#Verification#Multiple component consent]]
it("cancels a multi-workout request without writes, then retains it after a failed atomic save", async () => {
  const props = {
    team: context.teams[0],
    trackId: "everyday",
    date: "2026-09-07",
    sourceResults: [],
    onSaved: vi.fn(),
    libraryWorkoutIds: ["time", "load"],
    onLibraryWorkoutHandled: vi.fn(),
  }
  const { unmount } = render(<AthletePersonalSession {...props} />)
  await screen.findByText("Add 2 workouts?")
  expect(screen.getByRole("heading", { name: "Add 2 workouts?" })).toHaveFocus()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  expect(props.onLibraryWorkoutHandled).toHaveBeenCalledOnce()
  unmount()
  vi.mocked(savePersonalTrainingSessionFn).mockRejectedValue(
    new Error("Save failed"),
  )
  render(<AthletePersonalSession {...props} />)
  await screen.findByText("Add 2 workouts?")
  fireEvent.click(screen.getByRole("button", { name: "Add to my session" }))
  await screen.findByText("Save failed")
  expect(screen.getByText("Add 2 workouts?")).toBeInTheDocument()
  expect(savePersonalTrainingSessionFn).toHaveBeenCalledOnce()
  const input = vi.mocked(savePersonalTrainingSessionFn).mock.calls[0]?.[0]
    ?.data as import("@/lib/training/personal-types").SavePersonalTrainingSessionInput
  expect(
    input.items
      .filter((item) => item.kind === "library")
      .map((item) => item.workoutId),
  ).toEqual(["time", "load"])
  expect(input.trainingDate).toBe("2026-09-07")
})
it("keeps personal sessions available with no followed tracks", async () => {
  render(
    <AthleteTraining
      context={{ ...context, teams: [{ ...context.teams[0], tracks: [] }] }}
      initialDate="2026-09-07"
    />,
  )
  await screen.findByRole("link", { name: "Browse tracks" })
  expect(
    screen.getByRole("button", { name: "My progress" }),
  ).toBeInTheDocument()
  expect(getPersonalTrainingDayFn).toHaveBeenCalled()
})

it("keeps gym coaching tools out of an owned personal workspace", async () => {
  render(
    <AthleteTraining
      context={{
        ...context,
        teams: [
          {
            ...context.teams[0],
            isPersonal: true,
            canProgram: true,
            name: "My training",
          },
        ],
      }}
      initialDate="2026-09-07"
      initialView="team"
    />,
  )
  await screen.findByRole("heading", { name: "My training" })
  expect(
    screen.queryByRole("link", { name: "Coach tools" }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: /^Team$/ }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "My session" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
})

// @lat: [[training#Provider Verification#Failed source reads discard stale programming]]
it("removes the prior provider source after a new track read fails and retries the selected track", async () => {
  const empty = {
    defaultTrackId: "everyday",
    selectedTrackId: "everyday",
    sourceSession: null,
    personalSession: null,
    items: [],
    results: [],
    libraryResults: [],
  }
  vi.mocked(getPersonalTrainingDayFn).mockResolvedValueOnce({
    ...empty,
    source: {
      kind: "provider-day",
      day: {
        id: "provider-a",
        date: "2026-09-07",
        url: "https://www.crossfit.com/260907",
        kind: "workout",
        markdown: "Provider A prescription",
        workouts: [
          { workoutId: "a", name: "Provider A workout", scheme: "time" },
        ],
      },
    },
  })
  const props = {
    team: context.teams[0],
    date: "2026-09-07",
    sourceResults: [],
    onSaved: vi.fn(),
  }
  const { rerender } = render(
    <AthletePersonalSession {...props} trackId="everyday" />,
  )
  await screen.findByRole("heading", { name: "Provider A workout" })
  vi.mocked(getPersonalTrainingDayFn).mockRejectedValueOnce(
    new Error("Could not load track B"),
  )
  rerender(<AthletePersonalSession {...props} trackId="compete" />)
  await screen.findByText("Could not load track B")
  expect(screen.queryByText("Provider A prescription")).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Add to my day" }),
  ).not.toBeInTheDocument()
  vi.mocked(getPersonalTrainingDayFn).mockResolvedValueOnce({
    ...empty,
    selectedTrackId: "compete",
    source: { kind: "unavailable" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  await waitFor(() =>
    expect(getPersonalTrainingDayFn).toHaveBeenLastCalledWith({
      data: { teamId: "gym", trackId: "compete", trainingDate: "2026-09-07" },
    }),
  )
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
})

// @lat: [[training#Provider Verification#Unavailable defaults stay explicit]]
it("offers an explicit default save when the saved track is unavailable", async () => {
  vi.mocked(getPersonalTrainingDayFn).mockResolvedValue({
    defaultTrackId: "everyday",
    defaultUnavailable: true,
    selectedTrackId: "everyday",
    sourceSession: null,
    personalSession: null,
    items: [],
    results: [],
    libraryResults: [],
  })
  render(<AthleteTraining context={context} initialDate="2026-09-07" />)
  const saveDefault = await screen.findByRole("button", { name: "Make default track" })
  expect(screen.getByLabelText("Training track")).toHaveValue("everyday")
  expect(screen.queryByText("Default track")).not.toBeInTheDocument()
  expect(saveDefault).toBeEnabled()
  expect(saveTrainingPreferenceFn).not.toHaveBeenCalled()
  expect(savePersonalTrainingSessionFn).not.toHaveBeenCalled()
  fireEvent.click(saveDefault)
  await waitFor(() => expect(saveTrainingPreferenceFn).toHaveBeenCalledExactlyOnceWith({
    data: { teamId: "gym", defaultTrackId: "everyday" },
  }))
  expect(await screen.findByText("Default track")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Make default track" })).not.toBeInTheDocument()
  expect(screen.queryByText(/Your saved default is unavailable/)).not.toBeInTheDocument()
})
