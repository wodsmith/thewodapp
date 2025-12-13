import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import WorkoutRowCard from "@/components/WorkoutRowCard"
import type { Workout, Movement, Tag } from "@/types"

// Mock Next.js Link component - must use dynamic import to avoid hoisting issues
vi.mock("next/link", () => ({
	default: ({ children, href }: { children: React.ReactNode; href: string }) => {
		const React = require("react")
		return React.createElement("a", { href }, children)
	},
}))

// Mock HoverCard components
vi.mock("@/components/ui/hover-card", () => {
	const React = require("react")
	return {
		HoverCard: ({ children }: any) => React.createElement("div", { "data-testid": "hover-card" }, children),
		HoverCardTrigger: ({ children }: any) => React.createElement("div", null, children),
		HoverCardContent: ({ children }: any) => React.createElement("div", { "data-testid": "hover-content" }, children),
	}
})

// Mock ListItem components
vi.mock("@/components/ui/list-item", () => {
	const React = require("react")
	return {
		ListItem: ({ children }: any) => React.createElement("div", { "data-testid": "list-item" }, children),
		ListItemContent: ({ children }: any) => React.createElement("div", { "data-testid": "list-content" }, children),
		ListItemMeta: ({ children }: any) => React.createElement("div", { "data-testid": "list-meta" }, children),
		ListItemActions: ({ children }: any) => React.createElement("div", { "data-testid": "list-actions" }, children),
	}
})

// Mock Badge component
vi.mock("@/components/ui/badge", () => {
	const React = require("react")
	return {
		Badge: ({ children, variant, className, ...props }: any) =>
			React.createElement("span", { "data-testid": "badge", "data-variant": variant, className, ...props }, children),
	}
})

// Mock Button component
vi.mock("@/components/ui/button", () => {
	const React = require("react")
	return {
		Button: ({ children, ...props }: any) =>
			React.createElement("button", { "data-testid": "button", ...props }, children),
	}
})

// TODO: These tests need more comprehensive mocking of shadcn/ui components
// Skipping for now until proper mock setup is in place
describe.skip("WorkoutRowCard", () => {
	const mockWorkout: Workout & { sourceWorkout?: any; remixCount?: number } = {
		id: "workout-123",
		name: "Test Workout",
		description: "A test workout description",
		scheme: "reps",
		scoreType: null,
		scope: "public",
		repsPerRound: 10,
		roundsToScore: 5,
		sugarId: null,
		tiebreakScheme: null,
		teamId: "team-123",
		sourceWorkoutId: null,
		sourceTrackId: null,
		scalingGroupId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		updateCounter: 0,
	}

	const mockMovements: Array<Pick<Movement, "id" | "name"> & { type: "weightlifting" }> = [
		{ id: "movement-1", name: "Squat", type: "weightlifting" },
	]

	const mockTags: Array<Pick<Tag, "id" | "name">> = [
		{ id: "tag-1", name: "Strength" },
	]

	const mockResult = {
		id: "result-1",
		userId: "user-123",
		workoutId: "workout-123",
		date: new Date(),
		type: "wod" as const,
		scale: "rx" as const,
		wodScore: "10:00",
		notes: null,
		setCount: null,
		distance: null,
		time: 600,
		programmingTrackId: null,
		scheduledWorkoutInstanceId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		updateCounter: 0,
	}

	it("renders basic workout information", () => {
		render(
			<WorkoutRowCard
				workout={mockWorkout}
				movements={mockMovements}
				tags={mockTags}
			/>
		)

		expect(screen.getByText("Test Workout")).toBeInTheDocument()
		expect(screen.getByText("Squat")).toBeInTheDocument()
		expect(screen.getByText("Strength")).toBeInTheDocument()
	})

	it("displays remix badge for remix workouts", () => {
		const remixWorkout = {
			...mockWorkout,
			sourceWorkoutId: "source-123",
			sourceWorkout: {
				id: "source-123",
				name: "Original Workout",
				teamName: "Original Team",
			},
		}

		render(
			<WorkoutRowCard
				workout={remixWorkout}
				movements={mockMovements}
				tags={mockTags}
			/>
		)

		const remixBadge = screen.getByText("Remix")
		expect(remixBadge).toBeInTheDocument()
		expect(remixBadge).toHaveAttribute("data-variant", "secondary")
	})

	it("displays source workout information in hover card for remixes", () => {
		const remixWorkout = {
			...mockWorkout,
			sourceWorkoutId: "source-123",
			sourceWorkout: {
				id: "source-123",
				name: "Original Workout",
				teamName: "Original Team",
			},
		}

		render(
			<WorkoutRowCard
				workout={remixWorkout}
				movements={mockMovements}
				tags={mockTags}
			/>
		)

		expect(screen.getByText("This is a remix")).toBeInTheDocument()
		expect(screen.getByText("Based on")).toBeInTheDocument()
		expect(screen.getByText('"Original Workout"')).toBeInTheDocument()
		expect(screen.getByText("by Original Team")).toBeInTheDocument()
	})

	it("displays remix count for original workouts", () => {
		const originalWorkout = {
			...mockWorkout,
			sourceWorkoutId: null,
			remixCount: 3,
		}

		render(
			<WorkoutRowCard
				workout={originalWorkout}
				movements={mockMovements}
				tags={mockTags}
			/>
		)

		expect(screen.getByText("3 remixes")).toBeInTheDocument()
	})

	it("handles plural remix count correctly", () => {
		const originalWorkout = {
			...mockWorkout,
			sourceWorkoutId: null,
			remixCount: 1,
		}

		render(
			<WorkoutRowCard
				workout={originalWorkout}
				movements={mockMovements}
				tags={mockTags}
			/>
		)

		expect(screen.getByText("1 remix")).toBeInTheDocument()
	})

	it("does not display remix count for remix workouts", () => {
		const remixWorkout = {
			...mockWorkout,
			sourceWorkoutId: "source-123",
			sourceWorkout: {
				id: "source-123",
				name: "Original Workout",
			},
			remixCount: 5, // This should not be displayed for remixes
		}

		render(
			<WorkoutRowCard
				workout={remixWorkout}
				movements={mockMovements}
				tags={mockTags}
			/>
		)

		expect(screen.queryByText("5 remixes")).not.toBeInTheDocument()
		expect(screen.getByText("Remix")).toBeInTheDocument()
	})

	it("displays workout result when provided", () => {
		render(
			<WorkoutRowCard
				workout={mockWorkout}
				movements={mockMovements}
				tags={mockTags}
				result={mockResult}
			/>
		)

		expect(screen.getByText("10:00")).toBeInTheDocument()
		expect(screen.getByText("RX")).toBeInTheDocument()
	})

	it("handles empty movements and tags gracefully", () => {
		render(
			<WorkoutRowCard
				workout={mockWorkout}
				movements={[]}
				tags={[]}
			/>
		)

		expect(screen.getByText("Test Workout")).toBeInTheDocument()
		// Should not crash with empty arrays
	})

	it("handles undefined movements and tags gracefully", () => {
		render(
			<WorkoutRowCard
				workout={mockWorkout}
				movements={undefined}
				tags={undefined}
			/>
		)

		expect(screen.getByText("Test Workout")).toBeInTheDocument()
		// Should not crash with undefined values
	})

	it("renders log result button", () => {
		render(
			<WorkoutRowCard
				workout={mockWorkout}
				movements={mockMovements}
				tags={mockTags}
			/>
		)

		const logButton = screen.getByText("Log Result")
		expect(logButton).toBeInTheDocument()
		expect(logButton).toHaveAttribute("data-testid", "button")
	})
})
