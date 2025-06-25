import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import WorkoutControls from "./WorkoutControls"

describe("WorkoutControls", () => {
	beforeEach(() => {
		vi.useRealTimers()
		globalThis.__mockReplace.mockClear()
		globalThis.__searchParams = new URLSearchParams()
	})

	it("renders search input and dropdowns", async () => {
		render(
			<WorkoutControls
				allTags={["tag1", "tag2"]}
				allMovements={["move1", "move2"]}
			/>,
		)
		expect(
			screen.getByPlaceholderText("Search workouts..."),
		).toBeInTheDocument()

		const tagDropdown = screen.getByText("All Tags")
		expect(tagDropdown).toBeInTheDocument()
		fireEvent.click(tagDropdown)
		await waitFor(() => expect(screen.getByText("tag1")).toBeInTheDocument())

		const movementDropdown = screen.getByText("All Movements")
		expect(movementDropdown).toBeInTheDocument()
		fireEvent.click(movementDropdown)
		await waitFor(() => expect(screen.getByText("move1")).toBeInTheDocument())
	})

	it("updates URL params when controls change", async () => {
		vi.useFakeTimers()
		render(<WorkoutControls allTags={["tag1"]} allMovements={["move1"]} />)
		fireEvent.change(screen.getByPlaceholderText("Search workouts..."), {
			target: { value: "Fran" },
		})
		vi.advanceTimersByTime(500)

		const tagDropdown = screen.getByText("All Tags")
		fireEvent.click(tagDropdown)
		await waitFor(() => fireEvent.click(screen.getByText("tag1")))
		vi.advanceTimersByTime(500)

		const movementDropdown = screen.getByText("All Movements")
		fireEvent.click(movementDropdown)
		await waitFor(() => fireEvent.click(screen.getByText("move1")))
		vi.advanceTimersByTime(500)

		await waitFor(() => {
			expect(globalThis.__mockReplace).toHaveBeenCalledTimes(3)
			expect(globalThis.__mockReplace).toHaveBeenLastCalledWith(
				"/workouts?search=Fran&tag=tag1&movement=move1",
				{ scroll: false },
			)
		})
	})
})
