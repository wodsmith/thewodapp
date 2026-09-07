import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { VideoSubmissionForm } from "@/components/compete/video-submission-form"
import { submitVideoFn } from "@/server-fns/video-submission-fns"

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/video-submission-fns", () => ({
  getVideoSubmissionFn: vi.fn(),
  submitVideoFn: vi.fn(),
}))
vi.mock("@/components/ui/video-url-input", () => ({
  VideoUrlInput: ({
    id,
    value,
    onChange,
    onValidationChange,
  }: {
    id: string
    value: string
    onChange: (value: string) => void
    onValidationChange: (value: unknown) => void
  }) => (
    <input
      id={id}
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
        onValidationChange({
          isValid: true,
          isPending: false,
          error: null,
          parsedUrl: null,
        })
      }}
    />
  ),
}))
vi.mock("@/components/compete/video-submission-preview", () => ({
  VideoSubmissionPreview: (props: unknown) => (
    <pre data-testid="receipt">{JSON.stringify(props)}</pre>
  ),
}))

const workout = {
  workoutId: "workout",
  name: "Event",
  scheme: "time-with-cap" as const,
  scoreType: "min" as const,
  timeCap: 600,
  tiebreakScheme: "time" as const,
  repsPerRound: null,
  roundsToScore: 1,
}
const acceptedScore = {
  scoreValue: 600000,
  displayScore: "10:00",
  status: "cap",
  secondaryValue: 42,
  tiebreakValue: 123000,
  roundScores: [],
}
const mockSubmit = vi.mocked(submitVideoFn)

beforeEach(() => vi.clearAllMocks())

function renderForm(teamSize = 1) {
  return render(
    <VideoSubmissionForm
      competitionId="competition"
      trackWorkoutId="event"
      initialData={{
        submissions: [],
        teamSize,
        isCaptain: true,
        canSubmit: true,
        isRegistered: true,
        videoRequired: true,
        workout,
        existingScore: null,
      }}
    />,
  )
}

function fillForm() {
  fireEvent.change(screen.getByLabelText(/(?:Your|Team) Time/), {
    target: { value: "12:00" },
  })
  for (const input of screen.getAllByRole("textbox")) {
    if (input.id.includes("video"))
      fireEvent.change(input, {
        target: { value: `https://youtu.be/${input.id}` },
      })
  }
}

describe("server-accepted submission receipts", () => {
  // @lat: [[submission-receipts#Submission Receipts#Success uses accepted values]]
  it("uses the accepted normalized score and status instead of reparsing the draft", async () => {
    mockSubmit.mockResolvedValue({
      success: true,
      submissionId: "saved",
      isUpdate: false,
      acceptedScore,
      submissions: [{ submissionId: "saved", videoIndex: 0, isUpdate: false }],
    } as Awaited<ReturnType<typeof submitVideoFn>>)
    renderForm()
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await screen.findByText("Submitted successfully!")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(
      JSON.parse(screen.getByTestId("receipt").textContent ?? "{}").score,
    ).toMatchObject(acceptedScore)
  })

  // @lat: [[submission-receipts#Submission Receipts#Team form sends one batch]]
  it("sends all team evidence and its shared score in one request", async () => {
    mockSubmit.mockResolvedValue({
      success: true,
      submissionId: "saved",
      isUpdate: false,
      acceptedScore,
      submissions: [
        { submissionId: "first", videoIndex: 0, isUpdate: false },
        { submissionId: "second", videoIndex: 1, isUpdate: false },
      ],
    } as Awaited<ReturnType<typeof submitVideoFn>>)
    renderForm(2)
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await screen.findByText("Submitted successfully!")
    expect(mockSubmit).toHaveBeenCalledTimes(1)
    expect(mockSubmit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        score: "12:00",
        videos: [
          expect.objectContaining({
            videoIndex: 0,
            videoUrl: expect.stringContaining("https://youtu.be/"),
          }),
          expect.objectContaining({
            videoIndex: 1,
            videoUrl: expect.stringContaining("https://youtu.be/"),
          }),
        ],
      }),
    })
  })

  // @lat: [[submission-receipts#Submission Receipts#Rejected batch retains draft]]
  it("keeps the full draft and displays rejection without a success preview", async () => {
    mockSubmit.mockRejectedValue(new Error("Invalid tiebreak score"))
    renderForm(2)
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Submit result/i }))
    await screen.findByText("Invalid tiebreak score")
    expect(screen.queryByTestId("receipt")).not.toBeInTheDocument()
    expect(screen.getByLabelText(/(?:Your|Team) Time/)).toHaveValue("12:00")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Submit result/i }),
      ).toBeEnabled(),
    )
  })
})
