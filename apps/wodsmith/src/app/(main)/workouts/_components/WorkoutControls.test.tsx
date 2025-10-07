import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import WorkoutControls from "./WorkoutControls"

const mockReplace = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		replace: mockReplace,
	}),
	usePathname: () => "/workouts",
	useSearchParams: () => mockSearchParams,
}))

describe("WorkoutControls", () => {
	beforeEach(() => {
		vi.useRealTimers()
		mockReplace.mockClear()
		mockSearchParams.forEach((_, key) => mockSearchParams.delete(key))
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
			expect(mockReplace).toHaveBeenCalledTimes(3)
			expect(mockReplace).toHaveBeenLastCalledWith(
				"/workouts?search=Fran&tag=tag1&movement=move1",
				{ scroll: false },
			)
		})
	})
})
