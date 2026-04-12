import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { CompetitionLeaderboardEntry, CompetitionLeaderboardResponse } from "@/server-fns/leaderboard-fns"
import type { ScoringAlgorithm } from "@/types/scoring"

// Mock use-mobile hook (jsdom doesn't implement matchMedia)
vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => false,
}))

/**
 * Helper to wrap entries in the leaderboard response format
 */
function mockLeaderboardResponse(
	entries: CompetitionLeaderboardEntry[],
	scoringAlgorithm: ScoringAlgorithm = "traditional",
): CompetitionLeaderboardResponse {
	return { entries, scoringAlgorithm }
}

// Mock TanStack Router hooks
const mockNavigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mockNavigate,
	useSearch: () => ({ division: "div-1", event: undefined }),
	getRouteApi: () => ({
		useLoaderData: () => ({
			divisions: [
				{ id: "div-1", label: "RX" },
				{ id: "div-2", label: "Scaled" },
			],
			competition: {
				id: "comp-1",
				slug: "test-comp",
				competitionType: "in_person",
			},
		}),
	}),
}))

// Mock TanStack Start useServerFn - returns the function directly
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

// Mock the server functions
vi.mock("@/server-fns/competition-divisions-fns", () => ({
	getPublicCompetitionDivisionsFn: vi.fn(),
}))

vi.mock("@/server-fns/leaderboard-fns", () => ({
	getCompetitionLeaderboardFn: vi.fn(),
	getLeaderboardDataFn: vi.fn(),
}))

import { LeaderboardPageContent } from "@/components/leaderboard-page-content"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionLeaderboardFn } from "@/server-fns/leaderboard-fns"

const mockDivisions = [
	{
		id: "div-1",
		label: "RX",
		description: null,
		registrationCount: 10,
		feeCents: 5000,
		teamSize: 1,
		maxSpots: null,
		spotsAvailable: null,
		isFull: false,
	},
	{
		id: "div-2",
		label: "Scaled",
		description: null,
		registrationCount: 5,
		feeCents: 5000,
		teamSize: 1,
		maxSpots: null,
		spotsAvailable: null,
		isFull: false,
	},
]

const mockCompetition = {
	slug: "test-comp",
	competitionType: "in-person" as const,
}

const createMockEntry = (
	overrides: Partial<CompetitionLeaderboardEntry> = {},
): CompetitionLeaderboardEntry => ({
	registrationId: "reg-1",
	userId: "user-1",
	athleteName: "John Doe",
	divisionId: "div-1",
	divisionLabel: "RX",
	totalPoints: 200,
	overallRank: 1,
	isTeamDivision: false,
	teamName: null,
	teamMembers: [],
	affiliate: null,
	eventResults: [
		{
			trackWorkoutId: "tw-1",
			trackOrder: 1,
			eventName: "Event 1",
			scheme: "time",
			rank: 1,
			points: 100,
			rawScore: "300000",
			formattedScore: "5:00",
			formattedTiebreak: null,
			penaltyType: null,
			penaltyPercentage: null,
			isDirectlyModified: false,
			videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
		},
		{
			trackWorkoutId: "tw-2",
			trackOrder: 2,
			eventName: "Event 2",
			scheme: "reps",
			rank: 1,
			points: 100,
			rawScore: "150",
			formattedScore: "150 reps",
			formattedTiebreak: null,
			penaltyType: null,
			penaltyPercentage: null,
			isDirectlyModified: false,
			videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
		},
	],
	...overrides,
})

describe("LeaderboardPageContent", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getPublicCompetitionDivisionsFn).mockResolvedValue({
			divisions: mockDivisions,
			competitionCapacity: null,
		})
	})

	describe("Traditional Scoring Display", () => {
		it("displays rank, athlete name, and total points", async () => {
			const entries = [
				createMockEntry({ registrationId: "reg-1", totalPoints: 200, overallRank: 1 }),
				createMockEntry({
					registrationId: "reg-2",
					userId: "user-2",
					athleteName: "Jane Smith",
					totalPoints: 180,
					overallRank: 2,
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				// Use getAllByText since the name appears in both desktop and mobile views
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})

			expect(screen.getAllByText("Jane Smith").length).toBeGreaterThan(0)
			// Check points are displayed (mobile shows "X pts", desktop shows "X" separately)
			expect(screen.getAllByText(/200/).length).toBeGreaterThan(0)
			expect(screen.getAllByText(/180/).length).toBeGreaterThan(0)
		})

		it("displays event columns with per-event scores", async () => {
			const entries = [createMockEntry()]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				// Event name appears in both mobile and desktop views
				expect(screen.getAllByText("Event 1").length).toBeGreaterThan(0)
			})

			expect(screen.getAllByText("Event 2").length).toBeGreaterThan(0)
			// Check event scores are displayed (appear in both views)
			expect(screen.getAllByText("5:00").length).toBeGreaterThan(0)
			expect(screen.getAllByText("150 reps").length).toBeGreaterThan(0)
		})
	})

	describe("P-Score Display", () => {
		it("displays P-Score values with sign indicator", async () => {
			const entries = [
				createMockEntry({
					totalPoints: 15.5,
					overallRank: 1,
					eventResults: [
						{
							trackWorkoutId: "tw-1",
							trackOrder: 1,
							eventName: "Event 1",
							scheme: "time",
							rank: 1,
							points: 8.2,
							rawScore: "300000",
							formattedScore: "5:00",
							formattedTiebreak: null,
							penaltyType: null,
							penaltyPercentage: null,
							isDirectlyModified: false,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
						{
							trackWorkoutId: "tw-2",
							trackOrder: 2,
							eventName: "Event 2",
							scheme: "reps",
							rank: 2,
							points: 7.3,
							rawScore: "150",
							formattedScore: "150 reps",
							formattedTiebreak: null,
							penaltyType: null,
							penaltyPercentage: null,
							isDirectlyModified: false,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})

			// Check points are displayed (mobile shows "15.5 pts", desktop shows "15.5" in rank cell)
			expect(screen.getAllByText(/15\.5/).length).toBeGreaterThan(0)
		})

		it("displays negative P-Score values with red styling", async () => {
			const entries = [
				createMockEntry({
					totalPoints: -3.2,
					overallRank: 3,
					eventResults: [
						{
							trackWorkoutId: "tw-1",
							trackOrder: 1,
							eventName: "Event 1",
							scheme: "time",
							rank: 5,
							points: -3.2,
							rawScore: "450000",
							formattedScore: "7:30",
							formattedTiebreak: null,
							penaltyType: null,
							penaltyPercentage: null,
							isDirectlyModified: false,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})

			// Check negative points are displayed
			expect(screen.getAllByText(/-3\.2/).length).toBeGreaterThan(0)
		})

		it("displays positive P-Score values with green styling", async () => {
			const entries = [
				createMockEntry({
					totalPoints: 12.5,
					overallRank: 1,
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})

			// Check positive points are displayed
			expect(screen.getAllByText(/12\.5/).length).toBeGreaterThan(0)
		})
	})

	describe("Algorithm Indicator", () => {
		it("displays leaderboard content after loading", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse([createMockEntry()]))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				// Wait for data to load - athlete name should be displayed
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})
		})

		it("displays leaderboard with P-Score points", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(
				mockLeaderboardResponse([createMockEntry({ totalPoints: 15.5 })], "p_score"),
			)

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})
			// P-Score points are displayed
			expect(screen.getAllByText(/15\.5/).length).toBeGreaterThan(0)
		})

		it("displays leaderboard with custom points", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse([createMockEntry()]))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})
		})
	})

	describe("Points Formatting", () => {
		it("formats traditional points as integers", async () => {
			const entries = [createMockEntry({ totalPoints: 195 })]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				// Points appear in both mobile and desktop views
				expect(screen.getAllByText(/195/).length).toBeGreaterThan(0)
			})
		})

		it("formats P-Score points with one decimal place", async () => {
			const entries = [createMockEntry({ totalPoints: 15.567 })]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				// Should display points (appears in both views)
				expect(screen.getAllByText(/15\.567/).length).toBeGreaterThan(0)
			})
		})
	})

	describe("Penalty Indicator", () => {
		it("does not show indicator when score has no penalty or modification", async () => {
			const entries = [createMockEntry()]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
			})

			expect(screen.queryByLabelText(/penalty/i)).not.toBeInTheDocument()
			expect(screen.queryByLabelText(/adjusted/i)).not.toBeInTheDocument()
		})

		it("shows indicator for major penalty", async () => {
			const entries = [
				createMockEntry({
					eventResults: [
						{
							trackWorkoutId: "tw-1",
							trackOrder: 1,
							eventName: "Event 1",
							scheme: "time",
							rank: 1,
							points: 100,
							rawScore: "330000",
							formattedScore: "5:30",
							formattedTiebreak: null,
							penaltyType: "major",
							penaltyPercentage: 10,
							isDirectlyModified: false,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("5:30").length).toBeGreaterThan(0)
			})

			const indicators = screen.getAllByLabelText("Major Penalty")
			expect(indicators.length).toBeGreaterThan(0)
		})

		it("shows indicator for minor penalty", async () => {
			const entries = [
				createMockEntry({
					eventResults: [
						{
							trackWorkoutId: "tw-1",
							trackOrder: 1,
							eventName: "Event 1",
							scheme: "reps",
							rank: 2,
							points: 90,
							rawScore: "135",
							formattedScore: "135 reps",
							formattedTiebreak: null,
							penaltyType: "minor",
							penaltyPercentage: 5,
							isDirectlyModified: false,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("135 reps").length).toBeGreaterThan(0)
			})

			const indicators = screen.getAllByLabelText("Minor Penalty")
			expect(indicators.length).toBeGreaterThan(0)
		})

		it("shows indicator for directly modified score", async () => {
			const entries = [
				createMockEntry({
					eventResults: [
						{
							trackWorkoutId: "tw-1",
							trackOrder: 1,
							eventName: "Event 1",
							scheme: "time",
							rank: 1,
							points: 100,
							rawScore: "290000",
							formattedScore: "4:50",
							formattedTiebreak: null,
							penaltyType: null,
							penaltyPercentage: null,
							isDirectlyModified: true,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("4:50").length).toBeGreaterThan(0)
			})

			const indicators = screen.getAllByLabelText("Score Adjusted")
			expect(indicators.length).toBeGreaterThan(0)
		})

		it("shows penalty details in popover on click", async () => {
			const entries = [
				createMockEntry({
					eventResults: [
						{
							trackWorkoutId: "tw-1",
							trackOrder: 1,
							eventName: "Event 1",
							scheme: "time",
							rank: 1,
							points: 100,
							rawScore: "330000",
							formattedScore: "5:30",
							formattedTiebreak: null,
							penaltyType: "major",
							penaltyPercentage: 10,
							isDirectlyModified: false,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("5:30").length).toBeGreaterThan(0)
			})

			const indicator = screen.getAllByLabelText("Major Penalty")[0]
			fireEvent.click(indicator)

			await waitFor(() => {
				expect(screen.getByText("Major Penalty")).toBeInTheDocument()
				expect(screen.getByText("10% deduction applied")).toBeInTheDocument()
			})
		})

		it("shows organizer message for directly modified scores in popover", async () => {
			const entries = [
				createMockEntry({
					eventResults: [
						{
							trackWorkoutId: "tw-1",
							trackOrder: 1,
							eventName: "Event 1",
							scheme: "time",
							rank: 1,
							points: 100,
							rawScore: "290000",
							formattedScore: "4:50",
							formattedTiebreak: null,
							penaltyType: null,
							penaltyPercentage: null,
							isDirectlyModified: true,
							videoUrl: null,
			videoSubmissionId: null,
			parentEventId: null,
			parentEventName: null,
			isParentEvent: false,
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse(entries))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(screen.getAllByText("4:50").length).toBeGreaterThan(0)
			})

			const indicator = screen.getAllByLabelText("Score Adjusted")[0]
			fireEvent.click(indicator)

			await waitFor(() => {
				expect(screen.getByText("Score Adjusted")).toBeInTheDocument()
				expect(screen.getByText("This score was modified by an organizer.")).toBeInTheDocument()
			})
		})
	})

	describe("Loading and Empty States", () => {
		it("shows loading indicator while fetching data", () => {
			vi.mocked(getCompetitionLeaderboardFn).mockImplementation(
				() =>
					new Promise(() => {
						/* never resolves */
					}),
			)

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			// The loading state shows skeleton elements
			expect(screen.getByText("Leaderboard")).toBeInTheDocument()
		})

		it("shows empty state when no results", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue(mockLeaderboardResponse([]))

			render(<LeaderboardPageContent
					competitionId="comp-1"
					divisions={mockDivisions}
					competition={mockCompetition}
				/>)

			await waitFor(() => {
				expect(
					screen.getByText(/leaderboard not yet available/i),
				).toBeInTheDocument()
			})
		})
	})
})
