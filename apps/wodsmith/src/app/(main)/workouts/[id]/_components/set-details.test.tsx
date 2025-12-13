import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SetDetails } from "./set-details"

vi.mock("@/lib/scoring", () => ({
	decodeScore: (value: number) => `decoded-${value}`,
}))

describe("SetDetails", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders all set info with full data", () => {
		const sets = [
			{
				id: "scrd_1",
				scoreId: "score_1",
				roundNumber: 1,
				value: 754567,
				schemeOverride: null,
				status: null,
				secondaryValue: null,
				notes: "Good set",
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-01"),
				updateCounter: 0,
			},
		]
		render(<SetDetails sets={sets as any} workoutScheme={"time" as any} />)
		expect(screen.getByText("Set 1:")).toBeInTheDocument()
		expect(screen.getByText(/decoded-754567/)).toBeInTheDocument()
		expect(screen.getByText("(Good set)")).toBeInTheDocument()
	})

	it("renders CAP with secondary value", () => {
		const sets = [
			{
				id: "scrd_2",
				scoreId: "score_2",
				roundNumber: 2,
				value: 600000,
				schemeOverride: null,
				status: "cap",
				secondaryValue: 150,
				notes: null,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-01"),
				updateCounter: 0,
			},
		]
		render(
			<SetDetails sets={sets as any} workoutScheme={"time-with-cap" as any} />,
		)
		expect(screen.getByText("Set 2:")).toBeInTheDocument()
		expect(screen.getByText(/CAP - 150 reps/)).toBeInTheDocument()
		expect(screen.getByText(/decoded-600000/)).toBeInTheDocument()
	})

	it("renders nothing for null or empty sets", () => {
		const { container: c1 } = render(
			<SetDetails sets={null} workoutScheme={"time" as any} />,
		)
		expect(c1.firstChild).toBeNull()
		const { container: c2 } = render(
			<SetDetails sets={[]} workoutScheme={"time" as any} />,
		)
		expect(c2.firstChild).toBeNull()
	})
})
