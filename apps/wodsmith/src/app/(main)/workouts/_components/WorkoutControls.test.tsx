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
		render(<WorkoutControls allTags={["tag1"]} allMovements={["move1"]} />)

		// Change search input
		fireEvent.change(screen.getByPlaceholderText("Search workouts..."), {
			target: { value: "Fran" },
		})

		// Wait for URL update after search
		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/workouts?search=Fran", {
				scroll: false,
			})
		})

		// Select tag
		const tagDropdown = screen.getByText("All Tags")
		fireEvent.click(tagDropdown)
		const tag1Option = await screen.findByText("tag1")
		fireEvent.click(tag1Option)

		// Wait for URL update after tag selection
		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith(
				"/workouts?search=Fran&tag=tag1",
				{ scroll: false },
			)
		})

		// Select movement
		const movementDropdown = screen.getByText("All Movements")
		fireEvent.click(movementDropdown)
		const move1Option = await screen.findByText("move1")
		fireEvent.click(move1Option)

		// Wait for final URL update
		await waitFor(() => {
			expect(mockReplace).toHaveBeenLastCalledWith(
				"/workouts?search=Fran&tag=tag1&movement=move1",
				{ scroll: false },
			)
		})
	})
})
