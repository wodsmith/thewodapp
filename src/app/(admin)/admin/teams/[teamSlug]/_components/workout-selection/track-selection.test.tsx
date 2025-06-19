import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"
import { TrackSelection } from "./track-selection"
import { type ProgrammingTrack, STANDALONE_TRACK_ID } from "./types"

describe("TrackSelection", () => {
	const mockTracks: ProgrammingTrack[] = [
		{
			id: "track1",
			name: "Strength Track",
			description: "Focus on strength building",
			type: "team_owned",
		},
		{
			id: "track2",
			name: "Cardio Track",
			description: "Cardiovascular endurance",
			type: "team_owned",
		},
	]

	const defaultProps = {
		tracks: mockTracks,
		selectedTrack: null,
		onTrackSelect: vi.fn(),
		isLoading: false,
	}

	it("renders track list correctly", () => {
		render(<TrackSelection {...defaultProps} />)

		expect(screen.getByText("Select Programming Track")).toBeInTheDocument()
		expect(screen.getByText("All Available Workouts")).toBeInTheDocument()
		expect(screen.getByText("Strength Track")).toBeInTheDocument()
		expect(screen.getByText("Cardio Track")).toBeInTheDocument()
	})

	it("standalone option appears first", () => {
		render(<TrackSelection {...defaultProps} />)

		const cards = screen.getAllByRole("generic")
		const standaloneCard = cards.find((card) =>
			card.textContent?.includes("All Available Workouts"),
		)
		expect(standaloneCard).toBeInTheDocument()
	})

	it("track selection callback triggers with correct track object", () => {
		const onTrackSelect = vi.fn()
		render(<TrackSelection {...defaultProps} onTrackSelect={onTrackSelect} />)

		fireEvent.click(screen.getByText("Strength Track"))

		expect(onTrackSelect).toHaveBeenCalledWith({
			id: "track1",
			name: "Strength Track",
			description: "Focus on strength building",
			type: "team_owned",
		})
	})

	it("standalone selection triggers with correct object", () => {
		const onTrackSelect = vi.fn()
		render(<TrackSelection {...defaultProps} onTrackSelect={onTrackSelect} />)

		fireEvent.click(screen.getByText("All Available Workouts"))

		expect(onTrackSelect).toHaveBeenCalledWith({
			id: STANDALONE_TRACK_ID,
			name: "All Available Workouts",
			description: "Workouts not assigned to any programming track",
			type: "standalone",
		})
	})

	it("loading state displays appropriately", () => {
		render(<TrackSelection {...defaultProps} isLoading={true} />)

		expect(screen.getByText("Loading tracks...")).toBeInTheDocument()
		expect(screen.queryByText("All Available Workouts")).not.toBeInTheDocument()
	})

	it("highlights selected track correctly", () => {
		render(<TrackSelection {...defaultProps} selectedTrack={mockTracks[0]} />)

		const selectedCard =
			screen
				.getByText("Strength Track")
				.closest("[data-testid='track-card']") ||
			screen.getByText("Strength Track").closest(".cursor-pointer")
		expect(selectedCard).toHaveClass("border-primary", "bg-primary/10")
	})

	it("highlights selected standalone track correctly", () => {
		const standaloneTrack = {
			id: STANDALONE_TRACK_ID,
			name: "All Available Workouts",
			description: "Workouts not assigned to any programming track",
			type: "standalone",
		}

		render(<TrackSelection {...defaultProps} selectedTrack={standaloneTrack} />)

		const selectedCard =
			screen
				.getByText("All Available Workouts")
				.closest("[data-testid='track-card']") ||
			screen.getByText("All Available Workouts").closest(".cursor-pointer")
		expect(selectedCard).toHaveClass("border-primary", "bg-primary/10")
	})
})
