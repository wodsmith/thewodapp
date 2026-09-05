import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ComponentType, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AthleteScoreSubmissionPanel } from "@/components/compete/athlete-score-submission-panel"
import { VideoSubmissionForm } from "@/components/compete/video-submission-form"
import { Route as OverviewRoute } from "@/routes/compete/$slug/index"
import { Route as EventRoute } from "@/routes/compete/$slug/workouts/$eventId"
import {
  getAthleteDivisionSubmissionsFn,
  getVideoSubmissionFn,
  submitVideoFn,
} from "@/server-fns/video-submission-fns"

const routeFixture = vi.hoisted(() => ({ data: {} as Record<string, unknown> }))
const overviewFixture = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  parent: {} as Record<string, unknown>,
}))
vi.mock("@/server-fns/competition-workouts-page-fns", () => ({
  getPublicWorkoutsPageDataFn: vi.fn(),
}))
vi.mock("@/components/competition-location-card", () => ({
  CompetitionLocationCard: () => null,
}))
vi.mock("@/components/event-details-content", () => ({
  EventDetailsContent: () => null,
}))
vi.mock("@/components/registration-sidebar", () => ({
  RegistrationSidebar: () => null,
}))
vi.mock("@/utils/use-deferred-schedule", () => ({
  useDeferredSchedule: () => new Map(),
}))

vi.mock("@/server-fns/competition-event-page-fns", () => ({
  getPublicEventPageDataFn: vi.fn(),
}))
vi.mock("@/server-fns/competition-heats-fns", () => ({
  getPublicEventHeatsFn: vi.fn(),
  getPublicScheduleDataFn: vi.fn(),
}))
vi.mock("@/components/competition-tabs", () => ({
  CompetitionTabs: () => null,
}))
vi.mock("@/components/event-heat-schedule", () => ({
  EventHeatSchedule: () => null,
}))

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (fullPath: string) => (options: unknown) => ({
    options,
    fullPath,
    useLoaderData: () =>
      fullPath === "/compete/$slug/" ? overviewFixture.data : routeFixture.data,
    useParams: () => ({
      slug: "test",
      eventId: (routeFixture.data.event as { id: string } | undefined)?.id,
    }),
    useSearch: () => ({}),
  }),
  getRouteApi: () => ({ useLoaderData: () => overviewFixture.parent }),
  useNavigate: () => vi.fn(),
  notFound: vi.fn(),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/workout">{children}</a>
  ),
}))
vi.mock("@/server-fns/video-submission-fns", () => ({
  getAthleteDivisionSubmissionsFn: vi.fn(),
  getVideoSubmissionFn: vi.fn(),
  submitVideoFn: vi.fn(),
}))
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: ReactNode
    value: string
    onValueChange: (value: string) => void
    disabled?: boolean
  }) => (
    <select
      aria-label="Division"
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}))
vi.mock("@/components/ui/video-url-input", () => ({
  VideoUrlInput: ({
    id,
    value,
    onChange,
    onValidationChange,
    disabled,
  }: {
    id: string
    value: string
    onChange: (value: string) => void
    onValidationChange: (value: unknown) => void
    disabled?: boolean
  }) => (
    <input
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value)
        onValidationChange({
          isValid: e.target.value.startsWith("https://"),
          isPending: false,
          error: null,
          parsedUrl: null,
        })
      }}
    />
  ),
}))
vi.mock("@/components/compete/video-submission-preview", () => ({
  VideoSubmissionPreview: ({
    onEdit,
    submissions,
  }: {
    onEdit: () => void
    submissions: Array<{
      reviewStatus: string
      reviewerNotes: string | null
      statusUpdatedAt: Date | null
    }>
  }) => (
    <div>
      <span data-testid="preview-status">{submissions[0]?.reviewStatus}</span>
      <span data-testid="preview-review-notes">
        {submissions[0]?.reviewerNotes}
      </span>
      <span data-testid="preview-status-date">
        {submissions[0]?.statusUpdatedAt?.toISOString()}
      </span>
      <button type="button" onClick={onEdit}>
        Edit saved submission
      </button>
    </div>
  ),
}))

afterEach(() => vi.unstubAllGlobals())

const mockFetch = vi.mocked(getVideoSubmissionFn)
const mockSubmit = vi.mocked(submitVideoFn)
type InitialData = NonNullable<
  ComponentProps<typeof VideoSubmissionForm>["initialData"]
>
const divisions = [
  { divisionId: "a", registrationId: "registration-a", label: "Division A" },
  { divisionId: "b", registrationId: "registration-b", label: "Division B" },
  { divisionId: "c", registrationId: "registration-c", label: "Division C" },
]

function initialData(overrides: Partial<InitialData> = {}): InitialData {
  return {
    submissions: [],
    teamSize: 1,
    isCaptain: true,
    canSubmit: true,
    isRegistered: true,
    videoRequired: true,
    existingScore: null,
    workout: {
      workoutId: "workout",
      name: "Workout",
      scheme: "time-with-cap",
      scoreType: "min",
      timeCap: 600,
      tiebreakScheme: "time",
      repsPerRound: null,
      roundsToScore: 1,
    },
    ...overrides,
  }
}

function persistedScore(displayScore: string): InitialData["existingScore"] {
  return {
    scoreValue: 120000,
    displayScore,
    status: "scored",
    secondaryValue: null,
    tiebreakValue: null,
  }
}

function typeField(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function changeDivision(id: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Division" }), {
    target: { value: id },
  })
  await waitFor(() =>
    expect(
      screen.queryByText("Loading submission data..."),
    ).not.toBeInTheDocument(),
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const defaultProps = {
  trackWorkoutId: "event-1",
  competitionId: "competition",
  registeredDivisions: divisions,
  initialDivisionId: "a",
  initialData: initialData(),
}

beforeEach(() => {
  mockFetch.mockImplementation(
    async () =>
      initialData() as Awaited<ReturnType<typeof getVideoSubmissionFn>>,
  )
  mockSubmit.mockResolvedValue({
    success: true,
    submissionId: "saved",
    isUpdate: false,
    retainedCurrentBest: false,
  })
  vi.mocked(getAthleteDivisionSubmissionsFn).mockImplementation(
    async (options) => ({
      submissions: (
        (options?.data as { trackWorkoutIds?: string[] } | undefined)
          ?.trackWorkoutIds ?? []
      ).map((id) => ({
        trackWorkoutId: id,
        hasVideo: false,
        videoReviewStatus: null,
        hasScore: false,
        displayScore: null,
        scoreStatus: null,
        secondaryValue: null,
        verificationStatus: null,
        canSubmit: true,
        windowStatus: "open" as const,
      })),
    }),
  )
})

describe("athlete submission drafts", () => {
  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Late save preserves current division]]
  it("keeps the active division summary when another division finishes saving", async () => {
    const pending = deferred<Awaited<ReturnType<typeof submitVideoFn>>>()
    mockSubmit.mockReturnValueOnce(pending.promise)
    vi.mocked(getAthleteDivisionSubmissionsFn).mockImplementation(
      async (options) => ({
        submissions: (
          (options?.data as { trackWorkoutIds?: string[] } | undefined)
            ?.trackWorkoutIds ?? []
        ).map((id) => ({
          trackWorkoutId: id,
          hasVideo: false,
          videoReviewStatus: null,
          hasScore: true,
          displayScore:
            (options?.data as { divisionId?: string } | undefined)
              ?.divisionId === "b"
              ? "8:08"
              : "1:01",
          scoreStatus: "scored",
          secondaryValue: null,
          verificationStatus: null,
          canSubmit: true,
          windowStatus: "open" as const,
        })),
      }),
    )
    render(
      <AthleteScoreSubmissionPanel
        competitionId="competition"
        slug="test"
        userDivisions={divisions.slice(0, 2).map((division) => ({
          registration: {
            id: division.registrationId,
            divisionId: division.divisionId,
          },
          division: { id: division.divisionId, label: division.label },
        }))}
        workouts={[
          {
            id: "event-1",
            workoutId: "workout",
            trackOrder: 1,
            parentEventId: null,
            workout: { name: "Pending Workout", scheme: "time-with-cap" },
          },
        ]}
        eventDivisionMappings={{ hasMappings: false, mappings: [] }}
      />,
    )
    fireEvent.click(
      await screen.findByRole("button", { name: /Pending Workout/ }),
    )
    await screen.findByLabelText(/Your Time/)
    typeField("Video URL", "https://youtu.be/AAAAAAAAAAA")
    typeField(/Your Time/, "1:01")
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1))
    await changeDivision("1")
    await screen.findByText("8:08")
    const summaryFetchCount = vi.mocked(getAthleteDivisionSubmissionsFn).mock
      .calls.length
    await act(async () => {
      pending.resolve({
        success: true,
        submissionId: "saved",
        isUpdate: false,
        retainedCurrentBest: false,
      })
    })
    expect(screen.getByText("8:08")).toBeInTheDocument()
    expect(getAthleteDivisionSubmissionsFn).toHaveBeenCalledTimes(
      summaryFetchCount,
    )
    mockFetch.mockResolvedValue(
      initialData({ existingScore: persistedScore("4:30") }) as Awaited<
        ReturnType<typeof getVideoSubmissionFn>
      >,
    )
    await changeDivision("0")
    fireEvent.click(
      await screen.findByRole("button", { name: /Pending Workout/ }),
    )
    await screen.findByLabelText(/Your Time/)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("4:30")
    expect(screen.getByLabelText("Video URL")).toHaveValue("")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Single-score division drafts]]
  it("restores video, notes, score, cap reps, and tiebreak independently for each division", async () => {
    mockFetch.mockImplementation(
      async (options) =>
        initialData({
          existingScore: persistedScore(
            (options?.data as { divisionId?: string } | undefined)
              ?.divisionId === "b"
              ? "2:00"
              : "1:00",
          ),
        }) as Awaited<ReturnType<typeof getVideoSubmissionFn>>,
    )
    render(<VideoSubmissionForm {...defaultProps} />)
    typeField("Video URL", "https://youtu.be/AAAAAAAAAAA")
    typeField("Notes (Optional)", "A video notes")
    typeField(/Your Time/, "10:00")
    typeField("Reps Completed at Cap", "123")
    typeField("Tiebreak (Time)", "2:34")

    await changeDivision("b")
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("2:00")
    expect(screen.getByLabelText("Video URL")).toHaveValue("")
    typeField("Video URL", "https://youtu.be/BBBBBBBBBBB")
    typeField("Notes (Optional)", "B video notes")
    typeField(/Your Time/, "9:00")
    typeField("Tiebreak (Time)", "3:45")

    await changeDivision("a")
    expect(screen.getByLabelText("Video URL")).toHaveValue(
      "https://youtu.be/AAAAAAAAAAA",
    )
    expect(screen.getByLabelText("Notes (Optional)")).toHaveValue(
      "A video notes",
    )
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("10:00")
    expect(screen.getByLabelText("Reps Completed at Cap")).toHaveValue(123)
    expect(screen.getByLabelText("Tiebreak (Time)")).toHaveValue("2:34")
    await changeDivision("b")
    expect(screen.getByLabelText("Video URL")).toHaveValue(
      "https://youtu.be/BBBBBBBBBBB",
    )
    expect(screen.getByLabelText("Notes (Optional)")).toHaveValue(
      "B video notes",
    )
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("9:00")
    expect(screen.getByLabelText("Tiebreak (Time)")).toHaveValue("3:45")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Panel partner-round drafts]]
  it("preserves partner slots and round scores above keyed panel rows", async () => {
    const multi = initialData({
      teamSize: 2,
      workout: {
        ...initialData().workout!,
        scoreType: "sum",
        roundsToScore: 2,
      },
    })
    mockFetch.mockResolvedValue(
      multi as Awaited<ReturnType<typeof getVideoSubmissionFn>>,
    )
    render(
      <AthleteScoreSubmissionPanel
        competitionId="competition"
        slug="test"
        userDivisions={divisions.slice(0, 2).map((division) => ({
          registration: {
            id: division.registrationId,
            divisionId: division.divisionId,
          },
          division: { id: division.divisionId, label: division.label },
        }))}
        workouts={[
          {
            id: "event-1",
            workoutId: "workout",
            trackOrder: 1,
            parentEventId: null,
            workout: { name: "Partner Workout", scheme: "time-with-cap" },
          },
        ]}
        eventDivisionMappings={{ hasMappings: false, mappings: [] }}
      />,
    )
    fireEvent.click(
      await screen.findByRole("button", { name: /Partner Workout/ }),
    )
    await screen.findByLabelText("Round 1")
    typeField("Round 1", "4:01")
    fireEvent.click(screen.getByLabelText("Round 2 capped"))
    typeField("Round 2 reps completed", "112")
    typeField("Partner 1's Video", "https://youtu.be/AAAAAAAAAAA")
    typeField("Partner 2's Video", "https://youtu.be/BBBBBBBBBBB")
    fireEvent.change(
      screen.getByPlaceholderText("Notes for partner 1's video"),
      { target: { value: "Captain notes" } },
    )
    fireEvent.change(
      screen.getByPlaceholderText("Notes for partner 2's video"),
      { target: { value: "Partner notes" } },
    )
    typeField("Tiebreak (Time)", "1:23")

    await changeDivision("1")
    fireEvent.click(
      await screen.findByRole("button", { name: /Partner Workout/ }),
    )
    await screen.findByLabelText("Round 1")
    expect(screen.getByLabelText("Round 1")).toHaveValue("")
    typeField("Round 1", "6:00")
    typeField("Round 2", "7:00")
    await changeDivision("0")
    fireEvent.click(
      await screen.findByRole("button", { name: /Partner Workout/ }),
    )
    await screen.findByLabelText("Round 1")
    expect(screen.getByLabelText("Round 1")).toHaveValue("4:01")
    expect(screen.getByLabelText("Round 2")).toHaveValue("10:00")
    expect(screen.getByLabelText("Round 2 capped")).toBeChecked()
    expect(screen.getByLabelText("Round 2 reps completed")).toHaveValue(112)
    expect(screen.getByLabelText("Partner 1's Video")).toHaveValue(
      "https://youtu.be/AAAAAAAAAAA",
    )
    expect(screen.getByLabelText("Partner 2's Video")).toHaveValue(
      "https://youtu.be/BBBBBBBBBBB",
    )
    expect(
      screen.getByPlaceholderText("Notes for partner 1's video"),
    ).toHaveValue("Captain notes")
    expect(
      screen.getByPlaceholderText("Notes for partner 2's video"),
    ).toHaveValue("Partner notes")
    expect(screen.getByLabelText("Tiebreak (Time)")).toHaveValue("1:23")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Round cap division drafts]]
  it("restores explicit round caps and reps independently and submits the restored values", async () => {
    const multi = initialData({
      videoRequired: false,
      workout: {
        ...initialData().workout!,
        roundsToScore: 2,
        scoreType: "sum",
      },
    })
    mockFetch.mockResolvedValue(
      multi as Awaited<ReturnType<typeof getVideoSubmissionFn>>,
    )
    render(<VideoSubmissionForm {...defaultProps} initialData={multi} />)
    typeField("Round 1", "4:01")
    fireEvent.click(screen.getByLabelText("Round 2 capped"))
    typeField("Round 2 reps completed", "123")
    await changeDivision("b")
    expect(screen.getByLabelText("Round 2 capped")).not.toBeChecked()
    fireEvent.click(screen.getByLabelText("Round 1 capped"))
    typeField("Round 1 reps completed", "87")
    typeField("Round 2", "5:02")

    await changeDivision("a")
    expect(screen.getByLabelText("Round 1")).toHaveValue("4:01")
    expect(screen.getByLabelText("Round 1 capped")).not.toBeChecked()
    expect(screen.getByLabelText("Round 2 capped")).toBeChecked()
    expect(screen.getByLabelText("Round 2")).toHaveValue("10:00")
    expect(screen.getByLabelText("Round 2")).toBeDisabled()
    expect(screen.getByLabelText("Round 2 reps completed")).toHaveValue(123)
    await changeDivision("b")
    expect(screen.getByLabelText("Round 1 capped")).toBeChecked()
    expect(screen.getByLabelText("Round 1 reps completed")).toHaveValue(87)
    expect(screen.getByLabelText("Round 2 capped")).not.toBeChecked()
    expect(screen.getByLabelText("Round 2")).toHaveValue("5:02")
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await screen.findByText("Submitted successfully!")
    expect(mockSubmit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        divisionId: "b",
        roundScores: [
          { score: "10:00", status: "cap", secondaryScore: "87" },
          { score: "5:02", status: "scored", secondaryScore: null },
        ],
      }),
    })
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Persisted round cap initialization]]
  it("initializes round caps and reps from persisted results before the first edit", () => {
    const multi = initialData({
      workout: {
        ...initialData().workout!,
        roundsToScore: 2,
        scoreType: "sum",
      },
      existingScore: {
        ...persistedScore("14:01")!,
        status: "cap",
        roundScores: [
          {
            roundNumber: 1,
            value: 241000,
            displayScore: "4:01",
            status: "scored",
            secondaryValue: null,
          },
          {
            roundNumber: 2,
            value: 600000,
            displayScore: "10:00",
            status: "cap",
            secondaryValue: 123,
          },
        ],
      },
    })
    render(<VideoSubmissionForm {...defaultProps} initialData={multi} />)
    expect(screen.getByLabelText("Round 1 capped")).not.toBeChecked()
    expect(screen.getByLabelText("Round 2 capped")).toBeChecked()
    expect(screen.getByLabelText("Round 2 reps completed")).toHaveValue(123)
    expect(screen.getByLabelText("Round 2")).toBeDisabled()
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Late save retains newer revision]]
  it("retains newer edits after a previous save of the reopened draft finishes", async () => {
    const pending = deferred<Awaited<ReturnType<typeof submitVideoFn>>>()
    mockSubmit.mockReturnValueOnce(pending.promise)
    render(<VideoSubmissionForm {...defaultProps} />)
    typeField("Video URL", "https://youtu.be/AAAAAAAAAAA")
    typeField(/Your Time/, "1:01")
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1))
    await changeDivision("b")
    await changeDivision("a")
    typeField(/Your Time/, "2:02")
    await act(async () => {
      pending.resolve({
        success: true,
        submissionId: "saved",
        isUpdate: false,
        retainedCurrentBest: false,
      })
    })
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("2:02")
    await changeDivision("b")
    await changeDivision("a")
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("2:02")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Responsive overview drafts]]
  it("retains drafts when the actual overview moves its panel across the desktop breakpoint", async () => {
    const listeners = new Set<() => void>()
    const media = {
      matches: false,
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    }
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    )
    overviewFixture.parent = {
      competition: {
        id: "competition",
        slug: "test",
        competitionType: "online",
        timezone: "UTC",
      },
      userRegistration: { id: "registration-a" },
      session: { userId: "athlete" },
      userDivisions: [
        {
          registration: { id: "registration-a", divisionId: "a" },
          division: { id: "a", label: "Division A" },
        },
      ],
      userDivision: { id: "a", label: "Division A" },
      divisions: [],
      registrationStatus: { registrationOpen: true },
    }
    overviewFixture.data = {
      workouts: [
        {
          id: "event-1",
          workoutId: "workout",
          trackOrder: 1,
          parentEventId: null,
          workout: { name: "Workout", scheme: "time-with-cap" },
        },
      ],
      eventDivisionMappings: { hasMappings: false, mappings: [] },
      divisionDescriptionsMap: {},
      submissionStatusMap: {},
      benchmarkViewerScores: {},
    }
    const Page = OverviewRoute.options.component as ComponentType
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: /Workout/ }))
    await screen.findByLabelText(/Your Time/)
    typeField(/Your Time/, "1:23")
    typeField("Video URL", "https://youtu.be/AAAAAAAAAAA")
    for (const matches of [true, false]) {
      act(() => {
        media.matches = matches
        for (const listener of listeners) listener()
      })
      fireEvent.click(await screen.findByRole("button", { name: /Workout/ }))
      expect(await screen.findByLabelText(/Your Time/)).toHaveValue("1:23")
      expect(screen.getByLabelText("Video URL")).toHaveValue(
        "https://youtu.be/AAAAAAAAAAA",
      )
    }
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Saved inline form reloads persisted data]]
  it.each([false, true])(
    "reloads saved inline data without overwriting a newer draft (newer=%s)",
    async (hasNewerDraft) => {
      mockFetch.mockResolvedValue(
        initialData({ videoRequired: false }) as Awaited<
          ReturnType<typeof getVideoSubmissionFn>
        >,
      )
      render(
        <AthleteScoreSubmissionPanel
          competitionId="competition"
          slug="test"
          userDivisions={[
            {
              registration: { id: "registration-a", divisionId: "a" },
              division: { id: "a", label: "Division A" },
            },
          ]}
          workouts={[
            {
              id: "event-1",
              workoutId: "workout",
              trackOrder: 1,
              parentEventId: null,
              workout: { name: "Workout", scheme: "time-with-cap" },
            },
          ]}
          eventDivisionMappings={{ hasMappings: false, mappings: [] }}
        />,
      )
      fireEvent.click(await screen.findByRole("button", { name: /Workout/ }))
      await screen.findByLabelText(/Your Time/)
      typeField(/Your Time/, "4:30")
      fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
      await screen.findByText("Submitted successfully!")
      mockFetch.mockResolvedValue(
        initialData({
          videoRequired: false,
          existingScore: persistedScore("4:30"),
        }) as Awaited<ReturnType<typeof getVideoSubmissionFn>>,
      )
      if (hasNewerDraft) typeField(/Your Time/, "5:45")
      fireEvent.click(screen.getByRole("button", { name: /Workout/ }))
      await waitFor(() =>
        expect(screen.queryByLabelText(/Your Time/)).not.toBeInTheDocument(),
      )
      fireEvent.click(screen.getByRole("button", { name: /Workout/ }))
      expect(await screen.findByLabelText(/Your Time/)).toHaveValue(
        hasNewerDraft ? "5:45" : "4:30",
      )
      expect(mockFetch).toHaveBeenCalledTimes(2)
    },
  )

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Collapsed save reloads persisted data]]
  it("loads the saved result when submission finishes after its row was collapsed", async () => {
    const pending = deferred<Awaited<ReturnType<typeof submitVideoFn>>>()
    mockSubmit.mockReturnValueOnce(pending.promise)
    mockFetch.mockResolvedValue(
      initialData({ videoRequired: false }) as Awaited<
        ReturnType<typeof getVideoSubmissionFn>
      >,
    )
    render(
      <AthleteScoreSubmissionPanel
        competitionId="competition"
        slug="test"
        userDivisions={[
          {
            registration: { id: "registration-a", divisionId: "a" },
            division: { id: "a", label: "Division A" },
          },
        ]}
        workouts={[
          {
            id: "event-1",
            workoutId: "workout",
            trackOrder: 1,
            parentEventId: null,
            workout: { name: "Workout", scheme: "time-with-cap" },
          },
        ]}
        eventDivisionMappings={{ hasMappings: false, mappings: [] }}
      />,
    )
    fireEvent.click(await screen.findByRole("button", { name: /Workout/ }))
    await screen.findByLabelText(/Your Time/)
    typeField(/Your Time/, "4:30")
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole("button", { name: /Workout/ }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/Your Time/)).not.toBeInTheDocument(),
    )
    mockFetch.mockResolvedValue(
      initialData({
        videoRequired: false,
        existingScore: persistedScore("4:30"),
      }) as Awaited<ReturnType<typeof getVideoSubmissionFn>>,
    )
    await act(async () =>
      pending.resolve({
        success: true,
        submissionId: "saved",
        isUpdate: false,
        retainedCurrentBest: false,
      }),
    )
    fireEvent.click(screen.getByRole("button", { name: /Workout/ }))
    expect(await screen.findByLabelText(/Your Time/)).toHaveValue("4:30")
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Page-owned child drafts]]
  it("restores keyed child forms and standalone events from the page-owned draft map", () => {
    const event = (id: string) => ({
      id,
      workoutId: id,
      trackOrder: 1,
      parentEventId: null,
      workout: { ...initialData().workout!, name: id },
    })
    const childA = event("child-a")
    const childB = event("child-b")
    const parent = event("parent")
    const submission = initialData({ videoRequired: false })
    routeFixture.data = {
      competition: {
        id: "competition",
        competitionType: "online",
        timezone: "UTC",
      },
      event: parent,
      resources: [],
      judgingSheets: [],
      heatTimes: null,
      allTopLevelEvents: [parent],
      divisionDescriptions: [],
      divisions: [],
      athleteRegisteredDivisions: divisions.slice(0, 1),
      athleteRegisteredDivisionId: "a",
      initialSubmissionDivisionId: "a",
      venue: null,
      videoSubmission: null,
      childVideoSubmissions: { "child-a": submission, "child-b": submission },
      deferredEventHeats: Promise.resolve([]),
      childEvents: [childA],
      childDivisionDescriptions: {},
      parentEvent: null,
      isEventMappedToAthleteDivision: true,
      eventDivisionMappings: { hasMappings: false, mappings: [] },
    }
    const Page = EventRoute.options.component as ComponentType
    const { rerender } = render(<Page />)
    typeField(/Your Time/, "1:01")
    routeFixture.data = { ...routeFixture.data, childEvents: [childB] }
    rerender(<Page />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("")
    typeField(/Your Time/, "2:02")
    routeFixture.data = { ...routeFixture.data, childEvents: [childA] }
    rerender(<Page />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("1:01")

    routeFixture.data = {
      ...routeFixture.data,
      event: event("standalone"),
      childEvents: [],
      videoSubmission: submission,
    }
    rerender(<Page />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("")
    typeField(/Your Time/, "3:03")
    routeFixture.data = {
      ...routeFixture.data,
      event: parent,
      childEvents: [childB],
      videoSubmission: null,
    }
    rerender(<Page />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("2:02")
    routeFixture.data = {
      ...routeFixture.data,
      event: event("standalone"),
      childEvents: [],
      videoSubmission: submission,
    }
    rerender(<Page />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("3:03")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Event and registration isolation]]
  it("keeps drafts separate when an event or registration changes", () => {
    const { rerender } = render(<VideoSubmissionForm {...defaultProps} />)
    typeField(/Your Time/, "1:01")
    rerender(<VideoSubmissionForm {...defaultProps} trackWorkoutId="event-2" />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("")
    typeField(/Your Time/, "2:02")
    rerender(<VideoSubmissionForm {...defaultProps} />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("1:01")
    rerender(
      <VideoSubmissionForm
        {...defaultProps}
        registrationId="another-registration"
      />,
    )
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("")
    typeField(/Your Time/, "3:03")
    rerender(<VideoSubmissionForm {...defaultProps} />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("1:01")
    rerender(<VideoSubmissionForm {...defaultProps} trackWorkoutId="event-2" />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("2:02")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Successful save clears only its draft]]
  it("clears only the saved division so a later visit loads persisted data", async () => {
    render(<VideoSubmissionForm {...defaultProps} />)
    typeField(/Your Time/, "1:01")
    await changeDivision("b")
    typeField("Video URL", "https://youtu.be/BBBBBBBBBBB")
    typeField(/Your Time/, "2:02")
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await screen.findByText("Submitted successfully!")
    mockFetch.mockResolvedValue(
      initialData({ existingScore: persistedScore("4:30") }) as Awaited<
        ReturnType<typeof getVideoSubmissionFn>
      >,
    )
    await changeDivision("a")
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("1:01")
    await changeDivision("b")
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("4:30")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Failed save retains its draft]]
  it("retains a failed submission after leaving and returning", async () => {
    mockSubmit.mockRejectedValueOnce(new Error("Temporary save failure"))
    render(<VideoSubmissionForm {...defaultProps} />)
    typeField("Video URL", "https://youtu.be/AAAAAAAAAAA")
    typeField(/Your Time/, "3:21")
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await screen.findByText("Temporary save failure")
    await changeDivision("b")
    await changeDivision("a")
    expect(screen.getByLabelText("Video URL")).toHaveValue(
      "https://youtu.be/AAAAAAAAAAA",
    )
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("3:21")
  })

  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Late fetch preserves current edits]]
  it("ignores a late division response and a same-identity loader refresh while editing", async () => {
    const pending = deferred<Awaited<ReturnType<typeof getVideoSubmissionFn>>>()
    mockFetch.mockReturnValueOnce(pending.promise)
    const { rerender } = render(<VideoSubmissionForm {...defaultProps} />)
    typeField(/Your Time/, "1:01")
    fireEvent.change(screen.getByRole("combobox", { name: "Division" }), {
      target: { value: "b" },
    })
    await screen.findByText("Loading submission data...")
    rerender(<VideoSubmissionForm {...defaultProps} initialDivisionId="c" />)
    typeField(/Your Time/, "3:03")
    await act(async () => {
      pending.resolve(
        initialData({ existingScore: persistedScore("9:59") }) as Awaited<
          ReturnType<typeof getVideoSubmissionFn>
        >,
      )
    })
    expect(screen.getByRole("combobox", { name: "Division" })).toHaveValue("c")
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("3:03")
    rerender(
      <VideoSubmissionForm
        {...defaultProps}
        initialDivisionId="c"
        initialData={initialData({ existingScore: persistedScore("8:58") })}
      />,
    )
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("3:03")
    rerender(<VideoSubmissionForm {...defaultProps} />)
    expect(screen.getByLabelText(/Your Time/)).toHaveValue("1:01")
  })
  // @lat: [[domain#Domain Model#Video Submissions#Submission Drafts#Saved preview requires review]]
  it("shows pending review immediately after replacing a verified submission", async () => {
    const reviewed = initialData({
      existingScore: persistedScore("1:00"),
      submissions: [
        {
          id: "old-submission",
          videoIndex: 0,
          videoUrl: "https://youtu.be/AAAAAAAAAAA",
          notes: null,
          submittedAt: new Date("2026-01-01T12:00:00Z"),
          updatedAt: new Date("2026-01-01T12:00:00Z"),
          reviewStatus: "verified",
          reviewerNotes: "Old review",
          statusUpdatedAt: new Date("2026-01-01T12:00:00Z"),
        },
      ],
    })
    mockSubmit.mockResolvedValue({
      success: true,
      submissionId: "old-submission",
      isUpdate: true,
    })
    render(<VideoSubmissionForm {...defaultProps} initialData={reviewed} />)
    expect(screen.getByTestId("preview-status")).toHaveTextContent("verified")
    fireEvent.click(
      screen.getByRole("button", { name: "Edit saved submission" }),
    )
    typeField(/Your Time/, "1:30")
    fireEvent.click(screen.getByRole("button", { name: /Update submission/i }))
    await screen.findByText("Submission updated successfully!")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByTestId("preview-status")).toHaveTextContent("pending")
    expect(screen.getByTestId("preview-review-notes")).toBeEmptyDOMElement()
    expect(screen.getByTestId("preview-status-date")).not.toHaveTextContent(
      "2026-01-01T12:00:00.000Z",
    )
  })
})
