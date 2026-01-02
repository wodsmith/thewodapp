import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ScoringConfig } from "@/types/scoring"
import type { CompetitionLeaderboardEntry } from "@/server/competition-leaderboard"

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
	},
	{
		id: "div-2",
		label: "Scaled",
		description: null,
		registrationCount: 5,
		feeCents: 5000,
		teamSize: 1,
	},
]

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
		},
	],
	...overrides,
})

const createMockScoringConfig = (
	overrides: Partial<ScoringConfig> = {},
): ScoringConfig => ({
	algorithm: "traditional",
	traditional: { step: 5, firstPlacePoints: 100 },
	tiebreaker: { primary: "countback" },
	statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
	...overrides,
})

describe("LeaderboardPageContent", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getPublicCompetitionDivisionsFn).mockResolvedValue({
			divisions: mockDivisions,
		})
	})

	describe("Traditional Scoring Display", () => {
		it("displays rank, athlete name, and total points", async () => {
			const entries = [
				createMockEntry({ totalPoints: 200, overallRank: 1 }),
				createMockEntry({
					userId: "user-2",
					athleteName: "Jane Smith",
					totalPoints: 180,
					overallRank: 2,
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries,
				scoringConfig: createMockScoringConfig(),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText("John Doe")).toBeInTheDocument()
			})

			expect(screen.getByText("Jane Smith")).toBeInTheDocument()
			// Check points are displayed
			expect(screen.getByText("200")).toBeInTheDocument()
			expect(screen.getByText("180")).toBeInTheDocument()
		})

		it("displays event columns with per-event scores", async () => {
			const entries = [createMockEntry()]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries,
				scoringConfig: createMockScoringConfig(),
				events: [
					{ trackWorkoutId: "tw-1", name: "Event 1" },
					{ trackWorkoutId: "tw-2", name: "Event 2" },
				],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText("Event 1")).toBeInTheDocument()
			})

			expect(screen.getByText("Event 2")).toBeInTheDocument()
			// Check event scores are displayed
			expect(screen.getByText("5:00")).toBeInTheDocument()
			expect(screen.getByText("150 reps")).toBeInTheDocument()
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
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries,
				scoringConfig: createMockScoringConfig({
					algorithm: "p_score",
					pScore: { allowNegatives: true, medianField: "top_half" },
				}),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText("John Doe")).toBeInTheDocument()
			})

			// Check P-Score is displayed with decimal
			expect(screen.getByText("+15.5")).toBeInTheDocument()
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
						},
					],
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries,
				scoringConfig: createMockScoringConfig({
					algorithm: "p_score",
					pScore: { allowNegatives: true, medianField: "top_half" },
				}),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText("-3.2")).toBeInTheDocument()
			})

			// Check for red/negative styling class
			const negativeScore = screen.getByText("-3.2")
			expect(negativeScore).toHaveClass("text-red-600")
		})

		it("displays positive P-Score values with green styling", async () => {
			const entries = [
				createMockEntry({
					totalPoints: 12.5,
					overallRank: 1,
				}),
			]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries,
				scoringConfig: createMockScoringConfig({
					algorithm: "p_score",
					pScore: { allowNegatives: true, medianField: "top_half" },
				}),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText("+12.5")).toBeInTheDocument()
			})

			const positiveScore = screen.getByText("+12.5")
			expect(positiveScore).toHaveClass("text-green-600")
		})
	})

	describe("Algorithm Indicator", () => {
		it("displays 'Traditional' badge for traditional scoring", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries: [createMockEntry()],
				scoringConfig: createMockScoringConfig({ algorithm: "traditional" }),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText(/traditional/i)).toBeInTheDocument()
			})
		})

		it("displays 'P-Score' badge for P-Score scoring", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries: [createMockEntry({ totalPoints: 15.5 })],
				scoringConfig: createMockScoringConfig({
					algorithm: "p_score",
					pScore: { allowNegatives: true, medianField: "top_half" },
				}),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText(/p-score/i)).toBeInTheDocument()
			})
		})

		it("displays 'Custom' badge for custom scoring", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries: [createMockEntry()],
				scoringConfig: createMockScoringConfig({
					algorithm: "custom",
					customTable: { baseTemplate: "traditional", overrides: {} },
				}),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText(/custom/i)).toBeInTheDocument()
			})
		})
	})

	describe("Points Formatting", () => {
		it("formats traditional points as integers", async () => {
			const entries = [createMockEntry({ totalPoints: 195 })]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries,
				scoringConfig: createMockScoringConfig({ algorithm: "traditional" }),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(screen.getByText("195")).toBeInTheDocument()
			})
		})

		it("formats P-Score points with one decimal place", async () => {
			const entries = [createMockEntry({ totalPoints: 15.567 })]

			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries,
				scoringConfig: createMockScoringConfig({
					algorithm: "p_score",
					pScore: { allowNegatives: true, medianField: "top_half" },
				}),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				// Should round to one decimal
				expect(screen.getByText("+15.6")).toBeInTheDocument()
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

			render(<LeaderboardPageContent competitionId="comp-1" />)

			expect(screen.getByText(/loading/i)).toBeInTheDocument()
		})

		it("shows empty state when no results", async () => {
			vi.mocked(getCompetitionLeaderboardFn).mockResolvedValue({
				entries: [],
				scoringConfig: createMockScoringConfig(),
				events: [],
			})

			render(<LeaderboardPageContent competitionId="comp-1" />)

			await waitFor(() => {
				expect(
					screen.getByText(/leaderboard not yet available/i),
				).toBeInTheDocument()
			})
		})
	})
})
