import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { VideoSubmissionPreview } from "@/components/compete/video-submission-preview"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring"

// Mock lucide-react icons
vi.mock("lucide-react", () => {
	const icon =
		(name: string) =>
		({
			className,
			"aria-hidden": ariaHidden,
		}: {
			className?: string
			"aria-hidden"?: string | boolean
		}) => (
			<span
				data-testid={`icon-${name}`}
				className={className}
				aria-hidden={ariaHidden}
			/>
		)
	return {
		Calendar: icon("calendar"),
		CheckCircle2: icon("check-circle"),
		Clock: icon("clock"),
		Edit3: icon("edit"),
		ExternalLink: icon("external-link"),
		FileText: icon("file-text"),
		Trophy: icon("trophy"),
		Youtube: icon("youtube"),
	}
})

// Mock YouTube embed components
vi.mock("@/components/compete/youtube-embed", () => ({
	YouTubeEmbed: ({ url, title }: { url: string; title?: string }) => (
		<div data-testid="youtube-embed" data-url={url} data-title={title} />
	),
	isYouTubeUrl: (url: string) => {
		try {
			const parsed = new URL(url)
			return (
				parsed.hostname.includes("youtube.com") ||
				parsed.hostname.includes("youtu.be")
			)
		} catch {
			return false
		}
	},
}))

// Mock url utility
vi.mock("@/utils/url", () => ({
	isSafeUrl: (url: string) => {
		try {
			const parsed = new URL(url)
			return (
				parsed.protocol === "http:" || parsed.protocol === "https:"
			)
		} catch {
			return false
		}
	},
}))

const now = new Date("2025-06-15T12:00:00Z")
const earlier = new Date("2025-06-15T10:00:00Z")

function createDefaultSubmission(
	overrides?: Partial<{
		id: string
		videoUrl: string
		notes: string | null
		submittedAt: Date
		updatedAt: Date
	}>,
) {
	return {
		id: "sub-1",
		videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		notes: null,
		submittedAt: earlier,
		updatedAt: earlier,
		...overrides,
	}
}

function createDefaultWorkout(
	overrides?: Partial<{
		name: string
		scheme: WorkoutScheme
		scoreType: ScoreType | null
		timeCap: number | null
		tiebreakScheme: string | null
	}>,
) {
	return {
		name: "Fran",
		scheme: "time" as WorkoutScheme,
		scoreType: "min" as ScoreType | null,
		timeCap: null,
		tiebreakScheme: null,
		...overrides,
	}
}

describe("VideoSubmissionPreview", () => {
	describe("video display", () => {
		it("renders YouTube embed for YouTube URLs", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					canEdit={false}
				/>,
			)

			expect(screen.getByTestId("youtube-embed")).toBeTruthy()
		})

		it("renders external link for non-YouTube URLs", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({
						videoUrl: "https://vimeo.com/123456",
					})}
					canEdit={false}
				/>,
			)

			expect(screen.queryByTestId("youtube-embed")).toBeNull()
			expect(screen.getByText("External video link")).toBeTruthy()
			expect(screen.getByText("Open")).toBeTruthy()
		})

		it("uses safe URL href for external links", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({
						videoUrl: "https://vimeo.com/123456",
					})}
					canEdit={false}
				/>,
			)

			const link = screen.getByText("Open").closest("a")
			expect(link?.href).toContain("vimeo.com/123456")
		})

		it("uses # href for unsafe external URLs", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({
						videoUrl: "javascript:alert(1)",
					})}
					canEdit={false}
				/>,
			)

			const link = screen.getByText("Open").closest("a")
			expect(link?.getAttribute("href")).toBe("#")
		})
	})

	describe("score display", () => {
		it("displays score with scheme label", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					score={{
						scoreValue: 300000,
						displayScore: "5:00",
						status: "scored",
						secondaryValue: null,
						tiebreakValue: null,
					}}
					workout={createDefaultWorkout()}
					canEdit={false}
				/>,
			)

			expect(screen.getByText("5:00")).toBeTruthy()
			expect(screen.getByText("Your Time")).toBeTruthy()
		})

		it("shows 'Capped' badge when status is cap", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					score={{
						scoreValue: 600000,
						displayScore: "10:00",
						status: "cap",
						secondaryValue: 150,
						tiebreakValue: null,
					}}
					workout={createDefaultWorkout({
						scheme: "time-with-cap",
						timeCap: 600,
					})}
					canEdit={false}
				/>,
			)

			expect(screen.getByText("Capped")).toBeTruthy()
		})

		it("shows secondary value (reps at cap) when capped", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					score={{
						scoreValue: 600000,
						displayScore: "10:00",
						status: "cap",
						secondaryValue: 150,
						tiebreakValue: null,
					}}
					workout={createDefaultWorkout({
						scheme: "time-with-cap",
						timeCap: 600,
					})}
					canEdit={false}
				/>,
			)

			expect(
				screen.getByText("150 reps completed at cap"),
			).toBeTruthy()
		})

		it("does not show secondary value when not capped", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					score={{
						scoreValue: 300000,
						displayScore: "5:00",
						status: "scored",
						secondaryValue: null,
						tiebreakValue: null,
					}}
					workout={createDefaultWorkout()}
					canEdit={false}
				/>,
			)

			expect(
				screen.queryByText(/reps completed at cap/),
			).toBeNull()
		})

		it("shows tiebreak time when present", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					score={{
						scoreValue: 300000,
						displayScore: "5:00",
						status: "scored",
						secondaryValue: null,
						tiebreakValue: 225000, // 3:45
					}}
					workout={createDefaultWorkout({
						tiebreakScheme: "time",
					})}
					canEdit={false}
				/>,
			)

			expect(screen.getByText(/Tiebreak:/)).toBeTruthy()
			expect(screen.getByText(/3:45/)).toBeTruthy()
		})

		it("does not show tiebreak when no tiebreak scheme", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					score={{
						scoreValue: 300000,
						displayScore: "5:00",
						status: "scored",
						secondaryValue: null,
						tiebreakValue: 225000,
					}}
					workout={createDefaultWorkout({
						tiebreakScheme: null,
					})}
					canEdit={false}
				/>,
			)

			expect(screen.queryByText(/Tiebreak/)).toBeNull()
		})

		it("shows scheme-specific labels", () => {
			const schemes: Array<{ scheme: WorkoutScheme; label: string }> = [
				{ scheme: "reps", label: "Your Reps" },
				{ scheme: "load", label: "Your Load" },
				{ scheme: "rounds-reps", label: "Your Rounds + Reps" },
				{ scheme: "calories", label: "Your Calories" },
				{ scheme: "points", label: "Your Points" },
				{ scheme: "pass-fail", label: "Your Rounds Passed" },
			]

			for (const { scheme, label } of schemes) {
				const { unmount } = render(
					<VideoSubmissionPreview
						submission={createDefaultSubmission()}
						score={{
							scoreValue: 100,
							displayScore: "100",
							status: "scored",
							secondaryValue: null,
							tiebreakValue: null,
						}}
						workout={createDefaultWorkout({ scheme })}
						canEdit={false}
					/>,
				)

				expect(screen.getByText(label)).toBeTruthy()
				unmount()
			}
		})

		it("shows 'Your Score' when no workout provided", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					score={{
						scoreValue: 100,
						displayScore: "100",
						status: "scored",
						secondaryValue: null,
						tiebreakValue: null,
					}}
					canEdit={false}
				/>,
			)

			expect(screen.getByText("Your Score")).toBeTruthy()
		})
	})

	describe("notes display", () => {
		it("shows notes when present", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({
						notes: "Great workout!",
					})}
					canEdit={false}
				/>,
			)

			expect(screen.getByText("Great workout!")).toBeTruthy()
			expect(screen.getByText("Notes")).toBeTruthy()
		})

		it("does not show notes section when null", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({ notes: null })}
					canEdit={false}
				/>,
			)

			expect(screen.queryByText("Notes")).toBeNull()
		})
	})

	describe("edit button", () => {
		it("shows edit button when canEdit and onEdit provided", () => {
			const onEdit = vi.fn()
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					canEdit={true}
					onEdit={onEdit}
				/>,
			)

			expect(screen.getByText("Edit")).toBeTruthy()
		})

		it("hides edit button when canEdit false", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					canEdit={false}
					onEdit={vi.fn()}
				/>,
			)

			expect(screen.queryByRole("button", { name: /edit/i })).toBeNull()
		})

		it("hides edit button when no onEdit handler", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					canEdit={true}
				/>,
			)

			// The edit button in the header requires both canEdit AND onEdit
			const editButtons = screen.queryAllByText("Edit")
			// Should not have any edit buttons (the "Edit" text in header)
			expect(editButtons.length).toBe(0)
		})
	})

	describe("timestamps", () => {
		it("shows submitted timestamp", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({
						submittedAt: new Date("2025-06-15T10:00:00Z"),
					})}
					canEdit={false}
				/>,
			)

			expect(screen.getByText(/Submitted/)).toBeTruthy()
		})

		it("shows updated timestamp when different from submitted", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({
						submittedAt: earlier,
						updatedAt: now,
					})}
					canEdit={false}
				/>,
			)

			expect(screen.getByText(/Updated/)).toBeTruthy()
		})

		it("does not show updated timestamp when same as submitted", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission({
						submittedAt: earlier,
						updatedAt: earlier,
					})}
					canEdit={false}
				/>,
			)

			expect(screen.queryByText(/Updated/)).toBeNull()
		})
	})

	describe("edit status banners", () => {
		it("shows open window banner when canEdit", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					canEdit={true}
				/>,
			)

			expect(
				screen.getByText(
					/you can still update your submission/i,
				),
			).toBeTruthy()
		})

		it("shows edit reason when canEdit is false and reason provided", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					canEdit={false}
					editReason="Submission window closes tomorrow"
				/>,
			)

			// editReason appears in both CardDescription and amber banner
			expect(
				screen.getAllByText("Submission window closes tomorrow")
					.length,
			).toBeGreaterThan(0)
		})

		it("shows default closed message when canEdit false and no reason", () => {
			render(
				<VideoSubmissionPreview
					submission={createDefaultSubmission()}
					canEdit={false}
				/>,
			)

			expect(
				screen.getByText("Submission window is closed."),
			).toBeTruthy()
		})
	})
})
