import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AthleteTraining } from "@/components/training/athlete-training"
import { AthleteTeamResults } from "@/components/training/athlete-team-results"
import { TrainingResultDialog } from "@/components/training/training-result-dialog"
import type { OwnTrainingResult, TrainingBlock, TrainingContext, TrainingSession, TrainingWeek } from "@/lib/training/types"
import { getTrainingHistoryFn, getTrainingWeekFn, saveTrainingResultFn, setTrainingCheerFn } from "@/server-fns/training-fns"

vi.mock("@/server-fns/training-fns", () => ({
  getTrainingWeekFn: vi.fn(),
  getTrainingHistoryFn: vi.fn(),
  saveTrainingResultFn: vi.fn(),
  setTrainingCheerFn: vi.fn(),
}))

const block: TrainingBlock = { id: "squat", kind: "load", title: "Back squat", prescription: "Build to a heavy set of five.", scalingGuidance: "Choose a load you control.", coachGuidance: "" }
const session: TrainingSession = { id: "session-mon", teamId: "gym", trackId: "everyday", trainingDate: "2026-09-07", timezone: "America/Boise", revision: 2, publishedVersion: 2, draft: null, published: { title: "Strength for the week", coachNote: "Keep each rep smooth.", isRestDay: false, blocks: [block] } }
const context: TrainingContext = { userId: "me", activeTeamId: "gym", teams: [{ id: "gym", name: "Test gym", timezone: "America/Boise", canProgram: false, tracks: [{ id: "everyday", name: "Everyday", description: null }, { id: "compete", name: "Compete", description: null }] }, { id: "other", name: "Other gym", timezone: "Pacific/Auckland", canProgram: false, tracks: [{ id: "other-track", name: "Other plan", description: null }] }] }
const result: OwnTrainingResult = { id: "result-me", sessionId: session.id, blockId: block.id, publishedVersion: 2, userId: "me", userName: "Me", trainingDate: session.trainingDate, trackId: session.trackId, block, scoreValue: 102058, displayScore: "225", scaling: "rx", modification: "", audience: "private", unit: "lb", completed: true, cheerCount: 0, hasCheered: false, notes: "Private memory" }
const emptyWeek: TrainingWeek = { sessions: [], myResults: [], teamResults: [] }

beforeEach(() => {
  localStorage.clear()
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

  // @lat: [[training#Athlete Interface Tests#Encoded scores edit in display units]]
  it("edits load and time using display units instead of stored grams or milliseconds", async () => {
    const { unmount } = render(<TrainingResultDialog session={session} block={block} trackName="Everyday" gymName="Test gym" result={result} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
    expect(screen.getByLabelText("Load")).toHaveValue(225)
    expect(screen.getByLabelText("Load unit")).toHaveValue("lb")
    unmount()
    const timeBlock = { ...block, kind: "time" as const }
    render(<TrainingResultDialog session={session} block={timeBlock} trackName="Everyday" gymName="Test gym" result={{ ...result, block: timeBlock, displayScore: "12:34", scoreValue: 754000 }} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit result" }))
    expect(screen.getByLabelText("Minutes")).toHaveValue(12)
    expect(screen.getByLabelText("Seconds")).toHaveValue(34)
    fireEvent.click(screen.getByRole("button", { name: "Save result" }))
    await waitFor(() => expect(saveTrainingResultFn).toHaveBeenCalledWith({ data: expect.objectContaining({ score: "12:34" }) }))
  })

  // @lat: [[training#Athlete Interface Tests#Calendar preserves gym local dates]]
  it("uses the gym's day at the UTC boundary and keeps the date while switching tracks", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-08T02:00:00Z"))
    render(<AthleteTraining context={context} />)
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-07")
    await screen.findByRole("heading", { name: "Strength for the week" })
    fireEvent.change(screen.getByLabelText("Choose training date"), { target: { value: "2026-09-09" } })
    fireEvent.change(screen.getByLabelText("Your training track"), { target: { value: "compete" } })
    await waitFor(() => expect(getTrainingWeekFn).toHaveBeenLastCalledWith({ data: { teamId: "gym", trackId: "compete", startDate: "2026-09-07", mode: "athlete" } }))
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-09")
    expect(localStorage.getItem("wodsmith-training-track-v1:me:gym")).toBe("compete")
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-16")
    fireEvent.change(screen.getByLabelText("Gym or coaching group"), { target: { value: "other" } })
    expect(screen.getByLabelText("Choose training date")).toHaveValue("2026-09-08")
    await screen.findByRole("heading", { name: "Not published yet." })
  })

  // @lat: [[training#Athlete Interface Tests#Track switching rejects stale responses]]
  it("does not display an old track request that resolves after the new track", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-07T16:00:00Z"))
    let resolveOld: (week: TrainingWeek) => void = () => {}
    vi.mocked(getTrainingWeekFn).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve })).mockResolvedValueOnce({ ...emptyWeek, sessions: [{ ...session, id: "compete-session", trackId: "compete", published: { ...session.published!, title: "Compete day" } }] })
    render(<AthleteTraining context={context} />)
    fireEvent.change(screen.getByLabelText("Your training track"), { target: { value: "compete" } })
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
    expect(within(history).getByRole("link", { name: "Workout log" })).toHaveAttribute("href", "/log")
  })
})
