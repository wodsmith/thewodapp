import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type {
  TrainingContext,
  TrainingSession,
  TrainingWeek,
} from "@/lib/training/types"
import { CoachPlanner } from "./coach-planner"

const api = vi.hoisted(() => ({
  getWeek: vi.fn(),
  getOptions: vi.fn(),
  saveDraft: vi.fn(),
  publish: vi.fn(),
  copy: vi.fn(),
  blocker: vi.fn(),
}))

vi.mock("@/server-fns/training-fns", () => ({
  getTrainingWeekFn: api.getWeek,
  getTrainingWorkoutOptionsFn: api.getOptions,
  saveTrainingDraftFn: api.saveDraft,
  publishTrainingSessionFn: api.publish,
  copyTrainingSessionFn: api.copy,
}))
vi.mock("@tanstack/react-router", () => ({ useBlocker: api.blocker }))
const libraryApi = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
vi.mock("@/server-fns/training-personal-fns", () => ({
  listTrainingLibraryWorkoutsFn: libraryApi.list,
  getTrainingLibraryWorkoutFn: libraryApi.detail,
}))

const context: TrainingContext = {
  userId: "coach",
  activeTeamId: "gym",
  teams: [
    {
      id: "gym",
      name: "Northstar",
      timezone: "UTC",
      canProgram: true,
      tracks: [
        { id: "everyday", name: "Everyday", description: null },
        { id: "compete", name: "Compete", description: null },
      ],
    },
  ],
}

function trainingContent() {
  return {
    title: "Build a strong base",
    coachNote: "Leave two reps in reserve.",
    isRestDay: false,
    blocks: [
      {
        id: "squat",
        kind: "load" as const,
        title: "Back squat",
        prescription: "5 sets of 5",
        scalingGuidance: "Use a box if needed.",
        coachGuidance: "Brace before each rep.",
      },
    ],
  }
}

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  const content = trainingContent()
  return {
    id: "session-one",
    teamId: "gym",
    trackId: "everyday",
    trainingDate: "2026-09-07",
    timezone: "UTC",
    revision: 4,
    publishedVersion: 1,
    draft: content,
    published: content,
    ...overrides,
  }
}

function week(sessions = [session()]): TrainingWeek {
  return { sessions, myResults: [], teamResults: [] }
}

async function renderPlanner() {
  render(<CoachPlanner context={context} />)
  return screen.findByLabelText("Session title")
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-07T12:00:00Z"))
  api.blocker.mockReturnValue({ status: "idle" })
  api.getWeek.mockResolvedValue(week())
  api.getOptions.mockResolvedValue({ movements: [], scalingGroups: [] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("CoachPlanner", () => {
  // @lat: [[training#Coach Interface Tests#Failed saves preserve edits]]
  it("keeps failed-save edits and requires a discard decision before changing days", async () => {
    const title = await renderPlanner()
    api.saveDraft.mockRejectedValue(
      new Error("CONFLICT: This session changed. Reload before saving."),
    )
    fireEvent.change(title, { target: { value: "My unsaved coaching plan" } })
    expect(
      screen.getByRole("button", { name: "Review & publish" }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your edits are still here",
    )
    expect(title).toHaveValue("My unsaved coaching plan")
    expect(api.saveDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expectedRevision: 4,
        teamId: "gym",
        trackId: "everyday",
        trainingDate: "2026-09-07",
      }),
    })
    expect(api.blocker.mock.lastCall?.[0].shouldBlockFn()).toBe(true)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tue, Sep 8/ })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: /Tue, Sep 8/ }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Discard unsaved changes?",
    )
    fireEvent.click(screen.getByRole("button", { name: "Stay on this day" }))
    expect(title).toHaveValue("My unsaved coaching plan")
    fireEvent.click(screen.getByRole("button", { name: /Tue, Sep 8/ }))
    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText("Session title")).toHaveValue(""),
    )
  })

  // @lat: [[training#Coach Interface Tests#Publication uses saved revision]]
  it("reviews the saved destination and publishes with the returned optimistic revision", async () => {
    const title = await renderPlanner()
    const saved = session({
      revision: 5,
      draft: { ...trainingContent(), title: "Strength and steadiness" },
      timezone: "America/Boise",
    })
    api.saveDraft.mockResolvedValue(saved)
    api.publish.mockResolvedValue({
      ...saved,
      revision: 6,
      publishedVersion: 2,
      published: saved.draft,
      draft: null,
    })
    fireEvent.change(title, { target: { value: "Strength and steadiness" } })
    fireEvent.change(screen.getByLabelText("Training timezone"), {
      target: { value: "America/Boise" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Review & publish" }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: "Review & publish" }))
    const review = screen.getByRole("dialog")
    for (const label of [
      "Northstar",
      "Everyday",
      "America/Boise",
      "Monday, Sep 7, 2026",
      "Gym members with access to this programming track",
    ]) {
      expect(within(review).getByText(label)).toBeInTheDocument()
    }
    expect(review).toHaveTextContent(
      "Earlier results remain attached to the version athletes performed",
    )
    expect(api.publish).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole("button", { name: "Publish day" }))
    await waitFor(() =>
      expect(api.publish).toHaveBeenCalledWith({
        data: { sessionId: "session-one", expectedRevision: 5 },
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(
      screen.getByText(/Published version 2\. Athletes can now see/),
    ).toBeInTheDocument()
    expect(screen.getByText("Published · no edits")).toBeInTheDocument()
    expect(
      screen.getByText(
        "This day is published. Edit the session to start a new draft.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Review & publish" }),
    ).toBeDisabled()
    expect(
      screen.queryByText("Draft saved to this gym and track."),
    ).not.toBeInTheDocument()
  })

  // @lat: [[training#Coach Interface Tests#Copy protects occupied dates]]
  it("keeps occupied-destination copy errors open without replacing the source", async () => {
    await renderPlanner()
    api.copy.mockRejectedValue(
      new Error("Destination already has programming. Choose an empty day."),
    )
    fireEvent.click(screen.getByRole("button", { name: "Copy day to…" }))
    fireEvent.change(screen.getByLabelText("Destination track"), {
      target: { value: "compete" },
    })
    fireEvent.change(screen.getByLabelText("Destination date"), {
      target: { value: "2026-09-10" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Copy as draft" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Destination already has programming",
    )
    expect(api.copy).toHaveBeenCalledWith({
      data: {
        sessionId: "session-one",
        expectedRevision: 4,
        targetTrackId: "compete",
        targetDate: "2026-09-10",
      },
    })
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("Destination date")).toHaveValue("2026-09-10")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByLabelText("Session title")).toHaveValue(
      "Build a strong base",
    )
  })

  // @lat: [[training#Coach Interface Tests#Stale track reads are ignored]]
  it("ignores a previous track's late response after the coach switches tracks", async () => {
    let resolveOld: (value: TrainingWeek) => void = () => {}
    api.getWeek.mockReturnValueOnce(
      new Promise<TrainingWeek>((resolve) => {
        resolveOld = resolve
      }),
    )
    api.getWeek.mockResolvedValueOnce(
      week([
        session({
          id: "compete-session",
          trackId: "compete",
          draft: { ...trainingContent(), title: "Competition practice" },
        }),
      ]),
    )
    render(<CoachPlanner context={context} />)
    fireEvent.change(screen.getByLabelText("Programming track"), {
      target: { value: "compete" },
    })
    await waitFor(() =>
      expect(screen.getByLabelText("Session title")).toHaveValue(
        "Competition practice",
      ),
    )
    await act(async () => {
      resolveOld(week())
    })
    expect(screen.getByLabelText("Session title")).toHaveValue(
      "Competition practice",
    )
    expect(screen.getByLabelText("Programming track")).toHaveValue("compete")
  })

  // @lat: [[training#Coach Interface Tests#Preview matches programming]]
  it("previews section guidance and units, and confirms clearing sections for a rest day", async () => {
    await renderPlanner()
    const preview = screen.getByRole("complementary", {
      name: "Athlete preview",
    })
    expect(preview).toHaveTextContent("Leave two reps in reserve.")
    expect(preview).toHaveTextContent("5 sets of 5")
    expect(preview).toHaveTextContent("Log load · athlete chooses lb or kg")
    fireEvent.click(within(preview).getByText("Scaling options"))
    fireEvent.click(within(preview).getByText("Coach’s guidance"))
    expect(within(preview).getByText("Use a box if needed.")).toBeVisible()
    expect(within(preview).getByText("Brace before each rep.")).toBeVisible()
    fireEvent.click(screen.getByLabelText("Planned rest day"))
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "This removes the 1 sections",
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Keep training sections" }),
    )
    expect(preview).toHaveTextContent("Back squat")
    fireEvent.click(screen.getByLabelText("Planned rest day"))
    fireEvent.click(screen.getByRole("button", { name: "Make rest day" }))
    expect(preview).toHaveTextContent(
      "No result required. Rest is part of your programming.",
    )
    expect(preview).not.toHaveTextContent("Back squat")
    expect(
      screen.getByRole("button", { name: "Review & publish" }),
    ).toBeDisabled()
  })
})

// @lat: [[training#Workout Library#Library additions respect session capacity]]
it("reserves the remaining section slot while a library import is pending", async () => {
  const content = trainingContent()
  const firstBlock = content.blocks[0]
  if (!firstBlock) throw new Error("Missing test section")
  content.blocks = Array.from({ length: 19 }, (_, index) => ({
    ...firstBlock,
    id: `section-${index}`,
    title: `Section ${index}`,
  }))
  api.getWeek.mockResolvedValue(
    week([session({ draft: content, published: content })]),
  )
  const workout = {
    id: "fran",
    name: "Fran",
    description: "21-15-9",
    scheme: "time",
    scoreType: "min",
    roundsToScore: 1,
    timeCap: null,
    repsPerRound: null,
    tiebreakScheme: null,
  }
  let completeDetail!: (value: typeof workout) => void
  libraryApi.list.mockResolvedValue([workout])
  libraryApi.detail.mockReturnValue(
    new Promise((resolve) => {
      completeDetail = resolve
    }),
  )
  await renderPlanner()
  fireEvent.click(
    screen.getByRole("button", { name: "Add from workout library" }),
  )
  expect(
    screen.getByRole("button", { name: "Add instructions" }),
  ).toBeDisabled()
  expect(screen.getByRole("button", { name: "Create workout" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Search library" }))
  fireEvent.click(
    await screen.findByRole("button", { name: "Add Fran to draft" }),
  )
  fireEvent.click(screen.getByRole("button", { name: "Add instructions" }))
  await act(async () => completeDetail(workout))
  expect(
    screen.getByRole("button", { name: "Add instructions" }),
  ).toBeDisabled()
  expect(screen.getByRole("button", { name: "Create workout" })).toBeDisabled()
  api.saveDraft.mockResolvedValue(session({ revision: 5 }))
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
  await waitFor(() => expect(api.saveDraft).toHaveBeenCalled())
  expect(api.saveDraft.mock.lastCall?.[0].data.content.blocks).toHaveLength(20)
})

// @lat: [[workout-authoring#Programmer workflow regressions]]
it("guards an unapplied workout, preserves legacy content in the shared editor, and removes the edited workout", async () => {
  await renderPlanner()
  const section = screen.getByRole("region", { name: "Section 1: Back squat" })
  fireEvent.click(within(section).getByRole("button", { name: "Edit" }))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeEnabled(),
  )
  expect(screen.getByLabelText("Workout Name")).toHaveValue("Back squat")
  expect(screen.getByLabelText("Description")).toHaveValue("5 sets of 5")
  expect(api.blocker.mock.lastCall?.[0].shouldBlockFn()).toBe(false)
  fireEvent.change(screen.getByLabelText("Rounds to Score"), {
    target: { value: "5" },
  })
  expect(api.blocker.mock.lastCall?.[0].shouldBlockFn()).toBe(true)
  expect(api.saveDraft).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Apply changes" }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(
    screen.getByRole("complementary", { name: "Athlete preview" }),
  ).toHaveTextContent("5 scores")
  fireEvent.click(screen.getByRole("button", { name: "Remove Back squat" }))
  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    "Remove this section?",
  )
  fireEvent.click(screen.getByRole("button", { name: "Remove section" }))
  expect(
    screen.queryByRole("region", { name: "Section 1: Back squat" }),
  ).not.toBeInTheDocument()
})
