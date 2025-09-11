import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import WorkoutRowCard from "@/components/WorkoutRowCard"
import type { Workout, Movement, Tag } from "@/types"

// Mock React
vi.mock("react", () => ({
	default: React,
	...React,
}))

// Mock Next.js Link component
vi.mock("next/link", () => ({
	default: ({ children, href }: any) => React.createElement("a", { href }, children),
}))

// Mock HoverCard components
vi.mock("@/components/ui/hover-card", () => ({
	HoverCard: ({ children }: any) => <div data-testid="hover-card">{children}</div>,
	HoverCardTrigger: ({ children }: any) => <div>{children}</div>,
	HoverCardContent: ({ children }: any) => <div data-testid="hover-content">{children}</div>,
}))

// Mock ListItem components
vi.mock("@/components/ui/list-item", () => ({
	ListItem: ({ children }: any) => <div data-testid="list-item">{children}</div>,
	ListItemContent: ({ children }: any) => <div data-testid="list-content">{children}</div>,
	ListItemMeta: ({ children }: any) => <div data-testid="list-meta">{children}</div>,
	ListItemActions: ({ children }: any) => <div data-testid="list-actions">{children}</div>,
}))

// Mock Badge component
vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children, variant, className, ...props }: any) => (
		<span data-testid="badge" data-variant={variant} className={className} {...props}>
			{children}
		</span>
	),
}))

// Mock Button component
vi.mock("@/components/ui/button", () => ({
	Button: ({ children, ...props }: any) => (
		<button data-testid="button" {...props}>
			{children}
		</button>
	),
}))

describe("WorkoutRowCard", () => {
	const mockWorkout: Workout & { sourceWorkout?: any; remixCount?: number } = {
		id: "workout-123",
		name: "Test Workout",
		description: "A test workout description",
		scheme: "reps",
		scope: "public",
		repsPerRound: 10,
		roundsToScore: 5,
		sugarId: null,
		tiebreakScheme: null,
		secondaryScheme: null,
		teamId: "team-123",
		sourceWorkoutId: null,
		sourceTrackId: null,
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
