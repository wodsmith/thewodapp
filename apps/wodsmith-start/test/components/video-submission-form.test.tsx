import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReviewStatus } from "@/db/schemas/video-submissions"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring"

// Mock use-mobile hook (jsdom doesn't implement matchMedia)
vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => false,
}))

// Mock TanStack Start — useServerFn returns the fn directly
vi.mock("@tanstack/react-start", () => {
	const createChainable = (): Record<string, unknown> => {
		const fn = vi.fn() as unknown as Record<string, unknown>
		fn.inputValidator = () => createChainable()
		fn.handler = () => createChainable()
		fn.middleware = () => createChainable()
		fn.validator = () => createChainable()
		return fn
	}
	return {
		useServerFn: (fn: unknown) => fn,
		createServerFn: () => createChainable(),
	}
})

vi.mock("@/server-fns/video-submission-fns", () => ({
	submitVideoFn: vi.fn(),
	getVideoSubmissionFn: vi.fn(),
}))

// Mock video URL validation
vi.mock("@/schemas/video-url", () => ({
	getSupportedPlatformsText: () => "YouTube, Vimeo, or Streamable",
	parseVideoUrl: (url: string) => {
		try {
			const parsed = new URL(url)
			if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
				return { platform: "youtube", videoId: "test", url }
			}
			return { platform: "other", videoId: null, url }
		} catch {
			return null
		}
	},
}))

// Mock url utility
vi.mock("@/utils/url", () => ({
	isSafeUrl: (url: string) => {
		try {
			const parsed = new URL(url)
			return parsed.protocol === "http:" || parsed.protocol === "https:"
		} catch {
			return false
		}
	},
}))

// Mock scoring
vi.mock("@/lib/scoring", () => ({
	parseScore: vi.fn(() => ({ isValid: true, encoded: 330000, formatted: "5:30", error: null })),
	decodeScore: vi.fn(() => "5:30"),
}))

// Mock cn utility
vi.mock("@/lib/utils", () => ({
	cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

// Mock lucide-react icons
vi.mock("lucide-react", () => {
	const icon = (name: string) => ({ className, ...rest }: { className?: string }) => (
		<span data-testid={`icon-${name}`} className={className} {...rest} />
	)
	return {
		AlertCircle: icon("alert-circle"),
		Check: icon("check"),
		CheckCircle2: icon("check-circle"),
		ChevronDown: icon("chevron-down"),
		ChevronUp: icon("chevron-up"),
		ExternalLink: icon("external-link"),
		Loader2: icon("loader"),
	}
})

// Mock video-submission-preview
vi.mock("@/components/compete/video-submission-preview", () => ({
	VideoSubmissionPreview: ({ submissions, teamSize }: { submissions: unknown[]; teamSize: number }) => (
		<div data-testid="video-submission-preview">
			Preview: {submissions.length} of {teamSize}
		</div>
	),
}))

// Mock VideoUrlInput
vi.mock("@/components/ui/video-url-input", () => ({
	VideoUrlInput: ({
		id,
		value,
		onChange,
		onValidationChange,
	}: {
		id: string
		value: string
		onChange: (url: string) => void
		onValidationChange: (v: unknown) => void
	}) => (
		<input
			data-testid={`video-url-input-${id}`}
			value={value}
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

import { VideoSubmissionForm } from "@/components/compete/video-submission-form"

// ── Factories ──────────────────────────────────────────────────────────────

function createSubmission(overrides?: Partial<{
	id: string
	videoIndex: number
	videoUrl: string
	notes: string | null
	submittedAt: Date
	updatedAt: Date
	reviewStatus: ReviewStatus
	statusUpdatedAt: Date | null
	reviewerNotes: string | null
}>) {
	const now = new Date("2025-06-15T12:00:00Z")
	return {
		id: "sub-1",
		videoIndex: 0,
		videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		notes: null,
		submittedAt: now,
		updatedAt: now,
		reviewStatus: "pending" as ReviewStatus,
		statusUpdatedAt: null,
		reviewerNotes: null,
		...overrides,
	}
}

function createInitialData(overrides?: Partial<{
	submissions: ReturnType<typeof createSubmission>[]
	teamSize: number
	isCaptain: boolean
	canSubmit: boolean
	reason: string
	isRegistered: boolean
	submissionWindow: { opensAt: string; closesAt: string } | null
	workout: {
		workoutId: string
		name: string
		scheme: WorkoutScheme
		scoreType: ScoreType | null
		timeCap: number | null
		tiebreakScheme: string | null
		repsPerRound: number | null
		roundsToScore: number | null
	} | null
	existingScore: null
}>) {
	return {
		submissions: [],
		teamSize: 1,
		isCaptain: true,
		canSubmit: true,
		reason: undefined,
		isRegistered: true,
		submissionWindow: null,
		workout: null,
		existingScore: null,
		...overrides,
	}
}

function createDivisions(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		divisionId: `div-${i + 1}`,
		label: i === 0 ? "RX Male" : i === 1 ? "Scaled Female" : `Division ${i + 1}`,
	}))
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("VideoSubmissionForm", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("division selector", () => {
		it("renders dropdown when multiple divisions registered", () => {
			const divisions = createDivisions(2)

			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					registeredDivisions={divisions}
					initialData={createInitialData()}
				/>,
			)

			expect(screen.getByText("Submitting for:")).toBeTruthy()
			// The select trigger and dropdown items both render the division labels
			expect(screen.getAllByText("RX Male").length).toBeGreaterThan(0)
		})

		it("renders badge (not dropdown) when single division registered", () => {
			const divisions = createDivisions(1)

			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					registeredDivisions={divisions}
					initialData={createInitialData()}
				/>,
			)

			// Should show as a badge, not a dropdown
			expect(screen.getByText("Division:")).toBeTruthy()
			expect(screen.getByText("RX Male")).toBeTruthy()
			expect(screen.queryByText("Submitting for:")).toBeNull()
		})

		it("renders no selector when no divisions provided", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData()}
				/>,
			)

			expect(screen.queryByText("Submitting for:")).toBeNull()
			expect(screen.queryByText("Division:")).toBeNull()
		})

		it("shows division selector in submission closed state", () => {
			const divisions = createDivisions(2)

			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					registeredDivisions={divisions}
					initialData={createInitialData({
						canSubmit: false,
						reason: "Submission window has closed",
					})}
				/>,
			)

			expect(screen.getByText("Submitting for:")).toBeTruthy()
			expect(screen.getByText("Submission Closed")).toBeTruthy()
		})
	})

	describe("not registered state", () => {
		it("shows registration required when not registered", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({ isRegistered: false })}
				/>,
			)

			expect(screen.getByText("Registration Required")).toBeTruthy()
			expect(
				screen.getByText(
					"You must be registered for this competition to submit your result.",
				),
			).toBeTruthy()
		})
	})

	describe("non-captain team member view", () => {
		it("shows captain-only message for non-captain", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						isCaptain: false,
						teamSize: 3,
						isRegistered: true,
					})}
				/>,
			)

			expect(screen.getByText("Captain Only")).toBeTruthy()
			expect(
				screen.getByText(
					"Only your team captain can submit videos and scores for this event.",
				),
			).toBeTruthy()
		})

		it("shows team score for non-captain when score exists", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						isCaptain: false,
						teamSize: 3,
						isRegistered: true,
						existingScore: {
							scoreValue: 330000,
							displayScore: "5:30",
							status: "scored",
							secondaryValue: null,
							tiebreakValue: null,
						} as any,
					})}
				/>,
			)

			expect(screen.getByText("Team score:")).toBeTruthy()
			expect(screen.getByText("5:30")).toBeTruthy()
		})

		it("shows submitted videos for non-captain", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						isCaptain: false,
						teamSize: 3,
						isRegistered: true,
						submissions: [
							createSubmission({ videoIndex: 0, videoUrl: "https://youtube.com/watch?v=1" }),
							createSubmission({ id: "sub-2", videoIndex: 1, videoUrl: "https://youtube.com/watch?v=2" }),
						],
					})}
				/>,
			)

			expect(screen.getByText(/Submitted videos \(2 of 3\)/)).toBeTruthy()
			expect(screen.getByText(/Partner 1:/)).toBeTruthy()
			expect(screen.getByText(/Partner 2:/)).toBeTruthy()
		})
	})

	describe("team video slots", () => {
		it("renders multiple video input slots for team submissions", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						teamSize: 3,
						canSubmit: true,
					})}
				/>,
			)

			expect(screen.getByText("Submit Team Result")).toBeTruthy()
			expect(screen.getByText("Partner 1's Video")).toBeTruthy()
			expect(screen.getByText("Partner 2's Video")).toBeTruthy()
			expect(screen.getByText("Partner 3's Video")).toBeTruthy()
		})

		it("shows individual video URL label for teamSize 1", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						teamSize: 1,
						canSubmit: true,
					})}
				/>,
			)

			expect(screen.getByText("Video URL")).toBeTruthy()
			expect(screen.getByText("Submit Your Result")).toBeTruthy()
		})

		it("shows team score label when teamSize > 1 and workout provided", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						teamSize: 2,
						canSubmit: true,
						workout: {
							workoutId: "wk-1",
							name: "Fran",
							scheme: "time",
							scoreType: "min",
							timeCap: null,
							tiebreakScheme: null,
							repsPerRound: null,
							roundsToScore: 1,
						},
					})}
				/>,
			)

			expect(screen.getByText("Team Time")).toBeTruthy()
		})
	})

	describe("preview state with division selector", () => {
		it("shows division selector above preview when multiple divisions", () => {
			const divisions = createDivisions(2)

			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					registeredDivisions={divisions}
					initialData={createInitialData({
						submissions: [createSubmission()],
						canSubmit: true,
					})}
				/>,
			)

			// Should show preview with division selector
			expect(screen.getByTestId("video-submission-preview")).toBeTruthy()
			expect(screen.getByText("Submitting for:")).toBeTruthy()
		})
	})

	describe("submission window closed with existing submissions", () => {
		it("shows existing submission info when window closed", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						canSubmit: false,
						reason: "Submission window has closed",
						submissions: [createSubmission()],
					})}
				/>,
			)

			expect(screen.getByText("Submission Closed")).toBeTruthy()
			expect(screen.getByText("Submission window has closed")).toBeTruthy()
			expect(screen.getByText("Your submitted video:")).toBeTruthy()
		})

		it("shows team submission count when window closed for teams", () => {
			render(
				<VideoSubmissionForm
					trackWorkoutId="tw-1"
					competitionId="comp-1"
					initialData={createInitialData({
						canSubmit: false,
						reason: "Submission window has closed",
						teamSize: 3,
						submissions: [
							createSubmission({ videoIndex: 0 }),
							createSubmission({ id: "sub-2", videoIndex: 1 }),
						],
					})}
				/>,
			)

			expect(screen.getByText(/Submitted videos \(2 of 3\)/)).toBeTruthy()
		})
	})
})
