import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	CompetitionWorkoutCard,
	type SubmissionStatus,
} from "@/components/competition-workout-card"

// Mock TanStack Router Link
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		params,
		...rest
	}: {
		children: React.ReactNode
		to: string
		params: Record<string, string>
	}) => (
		<a href={`${to}?${new URLSearchParams(params).toString()}`} {...rest}>
			{children}
		</a>
	),
}))

// Mock lucide-react icons as simple spans
vi.mock("lucide-react", () => {
	const icon =
		(name: string) =>
		({ className }: { className?: string }) => (
			<span data-testid={`icon-${name}`} className={className} />
		)
	return {
		ArrowRight: icon("arrow-right"),
		CheckCircle2: icon("check-circle"),
		ClipboardCheck: icon("clipboard-check"),
		Clock: icon("clock"),
		Dumbbell: icon("dumbbell"),
		Edit3: icon("edit"),
		Eye: icon("eye"),
		Hash: icon("hash"),
		Lock: icon("lock"),
		MapPin: icon("map-pin"),
		Target: icon("target"),
		Timer: icon("timer"),
		Trophy: icon("trophy"),
	}
})

// Mock address utils
vi.mock("@/utils/address", () => ({
	getGoogleMapsUrl: vi.fn(() => null),
	hasAddressData: vi.fn(() => false),
}))

const defaultProps = {
	eventId: "event-1",
	slug: "test-comp",
	trackOrder: 1,
	name: "Fran",
	scheme: "time",
	description: "21-15-9 Thrusters and Pull-ups",
	roundsToScore: null,
	pointsMultiplier: null,
	divisionDescriptions: [],
}

describe("CompetitionWorkoutCard", () => {
	describe("CTA behavior based on submission status", () => {
		it("shows 'View Details' when not registered", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					isRegistered={false}
					submissionStatus={null}
				/>,
			)

			expect(screen.getAllByText("View Details").length).toBeGreaterThan(0)
		})

		it("shows 'View Details' when registered but no submission tracking (in-person)", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					isRegistered={true}
					submissionStatus={undefined}
				/>,
			)

			expect(screen.getAllByText("View Details").length).toBeGreaterThan(0)
		})

		it("shows 'Submit Score' when registered, not submitted, window open", () => {
			const status: SubmissionStatus = {
				hasSubmitted: false,
				canSubmit: true,
			}

			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					isRegistered={true}
					submissionStatus={status}
				/>,
			)

			expect(screen.getAllByText("Submit Score").length).toBeGreaterThan(0)
		})

		it("shows 'Edit Submission' with Submitted badge when submitted and window open", () => {
			const status: SubmissionStatus = {
				hasSubmitted: true,
				canSubmit: true,
			}

			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					isRegistered={true}
					submissionStatus={status}
				/>,
			)

			expect(
				screen.getAllByText("Edit Submission").length,
			).toBeGreaterThan(0)
			expect(screen.getByText("Submitted")).toBeTruthy()
		})

		it("shows 'View Submission' with Submitted badge when submitted and window closed", () => {
			const status: SubmissionStatus = {
				hasSubmitted: true,
				canSubmit: false,
			}

			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					isRegistered={true}
					submissionStatus={status}
				/>,
			)

			expect(
				screen.getAllByText("View Submission").length,
			).toBeGreaterThan(0)
			expect(screen.getByText("Submitted")).toBeTruthy()
		})

		it("shows 'Submission Closed' when not submitted and window closed", () => {
			const status: SubmissionStatus = {
				hasSubmitted: false,
				canSubmit: false,
			}

			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					isRegistered={true}
					submissionStatus={status}
				/>,
			)

			expect(
				screen.getAllByText("Submission Closed").length,
			).toBeGreaterThan(0)
		})
	})

	describe("scheme label display", () => {
		it("shows 'For Time' for time scheme without cap", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					scheme="time"
					timeCap={null}
				/>,
			)

			expect(screen.getByText("For Time")).toBeTruthy()
		})

		it("shows 'For Time (Capped)' for time scheme with cap", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					scheme="time"
					timeCap={600}
				/>,
			)

			expect(screen.getByText("For Time (Capped)")).toBeTruthy()
		})

		it("shows 'For Time (Capped)' for time-with-cap scheme", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					scheme="time-with-cap"
					timeCap={600}
				/>,
			)

			expect(screen.getByText("For Time (Capped)")).toBeTruthy()
		})

		it("shows 'AMRAP' for amrap scheme", () => {
			render(
				<CompetitionWorkoutCard {...defaultProps} scheme="amrap" />,
			)

			expect(screen.getByText("AMRAP")).toBeTruthy()
		})

		it("shows 'For Load' for load scheme", () => {
			render(
				<CompetitionWorkoutCard {...defaultProps} scheme="load" />,
			)

			expect(screen.getByText("For Load")).toBeTruthy()
		})

		it("shows 'EMOM' for emom scheme", () => {
			render(
				<CompetitionWorkoutCard {...defaultProps} scheme="emom" />,
			)

			expect(screen.getByText("EMOM")).toBeTruthy()
		})
	})

	describe("time cap formatting", () => {
		it("formats time cap as M:SS", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					scheme="time-with-cap"
					timeCap={600}
				/>,
			)

			expect(screen.getByText("10:00 Cap")).toBeTruthy()
		})

		it("formats short time cap", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					scheme="time-with-cap"
					timeCap={90}
				/>,
			)

			expect(screen.getByText("1:30 Cap")).toBeTruthy()
		})

		it("does not show time cap when null", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					scheme="time"
					timeCap={null}
				/>,
			)

			expect(screen.queryByText(/Cap$/)).toBeNull()
		})
	})

	describe("points multiplier display", () => {
		it("shows multiplier when not 100", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					pointsMultiplier={200}
				/>,
			)

			expect(screen.getByText("2x")).toBeTruthy()
		})

		it("does not show multiplier when 100 (default)", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					pointsMultiplier={100}
				/>,
			)

			expect(screen.queryByText("1x")).toBeNull()
		})

		it("does not show multiplier when null", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					pointsMultiplier={null}
				/>,
			)

			expect(screen.queryByText(/x$/)).toBeNull()
		})
	})

	describe("rounds display", () => {
		it("shows rounds when greater than 1", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					roundsToScore={3}
				/>,
			)

			expect(screen.getByText("3 Rounds")).toBeTruthy()
		})

		it("does not show rounds when 1", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					roundsToScore={1}
				/>,
			)

			expect(screen.queryByText(/Rounds/)).toBeNull()
		})
	})

	describe("track order display", () => {
		it("pads single digit track order", () => {
			render(
				<CompetitionWorkoutCard {...defaultProps} trackOrder={1} />,
			)

			expect(screen.getByText("01")).toBeTruthy()
		})

		it("shows double digit track order", () => {
			render(
				<CompetitionWorkoutCard {...defaultProps} trackOrder={12} />,
			)

			expect(screen.getByText("12")).toBeTruthy()
		})
	})

	describe("description and division scaling", () => {
		it("shows description text", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					description="21-15-9 Thrusters and Pull-ups"
				/>,
			)

			expect(
				screen.getByText("21-15-9 Thrusters and Pull-ups"),
			).toBeTruthy()
		})

		it("shows placeholder when no description", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					description={null}
				/>,
			)

			expect(
				screen.getByText("Details to be announced."),
			).toBeTruthy()
		})

		it("shows division-specific scale when selected division has description", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					selectedDivisionId="div-scaled"
					divisionDescriptions={[
						{
							divisionId: "div-scaled",
							divisionLabel: "Scaled",
							description: "55/35 lb thrusters",
						},
					]}
				/>,
			)

			expect(screen.getByText("Scaled")).toBeTruthy()
			expect(screen.getByText("55/35 lb thrusters")).toBeTruthy()
		})

		it("does not show division scale when no division selected", () => {
			render(
				<CompetitionWorkoutCard
					{...defaultProps}
					divisionDescriptions={[
						{
							divisionId: "div-scaled",
							divisionLabel: "Scaled",
							description: "55/35 lb thrusters",
						},
					]}
				/>,
			)

			expect(screen.queryByText("55/35 lb thrusters")).toBeNull()
		})
	})
})
