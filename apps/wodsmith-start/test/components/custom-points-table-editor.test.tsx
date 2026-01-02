import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	CustomPointsTableEditor,
	type CustomPointsTableEditorProps,
} from "@/components/compete/custom-points-table-editor"
import { WINNER_TAKES_MORE_TABLE } from "@/lib/scoring/algorithms/custom"

/**
 * Tests for the CustomPointsTableEditor component.
 *
 * This component allows organizers to customize the points awarded for each
 * placing in a competition. It displays a table of places (1-30) with editable
 * point values and supports overriding the base template values.
 */

function renderEditor(props: Partial<CustomPointsTableEditorProps> = {}) {
	const defaultProps: CustomPointsTableEditorProps = {
		baseTemplate: "traditional",
		overrides: {},
		traditionalConfig: { step: 5, firstPlacePoints: 100 },
		onChange: vi.fn(),
		disabled: false,
		...props,
	}
	return {
		...render(<CustomPointsTableEditor {...defaultProps} />),
		onChange: defaultProps.onChange,
	}
}

describe("CustomPointsTableEditor", () => {
	describe("Rendering", () => {
		it("renders the Edit Points Table button", () => {
			renderEditor()
			expect(
				screen.getByRole("button", { name: /edit points table/i }),
			).toBeInTheDocument()
		})

		it("button is disabled when disabled prop is true", () => {
			renderEditor({ disabled: true })
			expect(
				screen.getByRole("button", { name: /edit points table/i }),
			).toBeDisabled()
		})

		it("opens dialog when button is clicked", () => {
			renderEditor()

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			expect(screen.getByRole("dialog")).toBeInTheDocument()
			expect(screen.getByText(/custom points table/i)).toBeInTheDocument()
		})
	})

	describe("Dialog Content", () => {
		it("displays 30 rows for places 1-30", () => {
			renderEditor()

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			// Check for place labels - should have rows for places 1 through 30
			for (let place = 1; place <= 30; place++) {
				expect(screen.getByText(`${place}`)).toBeInTheDocument()
			}
		})

		it("displays traditional template values by default", () => {
			renderEditor({
				baseTemplate: "traditional",
				traditionalConfig: { step: 5, firstPlacePoints: 100 },
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			// Traditional with step 5: 100, 95, 90, 85, 80, 75, 70...
			const inputs = screen.getAllByRole("spinbutton")
			expect(inputs[0]).toHaveValue(100) // 1st place
			expect(inputs[1]).toHaveValue(95) // 2nd place
			expect(inputs[2]).toHaveValue(90) // 3rd place
		})

		it("displays winner_takes_more template values", () => {
			renderEditor({ baseTemplate: "winner_takes_more" })

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			const inputs = screen.getAllByRole("spinbutton")
			expect(inputs[0]).toHaveValue(WINNER_TAKES_MORE_TABLE[0]) // 100
			expect(inputs[1]).toHaveValue(WINNER_TAKES_MORE_TABLE[1]) // 85
			expect(inputs[2]).toHaveValue(WINNER_TAKES_MORE_TABLE[2]) // 75
		})

		it("displays p_score template values (same as traditional)", () => {
			renderEditor({
				baseTemplate: "p_score",
				traditionalConfig: { step: 5, firstPlacePoints: 100 },
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			// p_score uses traditional for static table
			const inputs = screen.getAllByRole("spinbutton")
			expect(inputs[0]).toHaveValue(100)
			expect(inputs[1]).toHaveValue(95)
		})
	})

	describe("Override Display", () => {
		it("displays overridden values in inputs", () => {
			renderEditor({
				baseTemplate: "traditional",
				overrides: { "1": 150, "3": 80 },
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			const inputs = screen.getAllByRole("spinbutton")
			expect(inputs[0]).toHaveValue(150) // 1st place overridden
			expect(inputs[1]).toHaveValue(95) // 2nd place default
			expect(inputs[2]).toHaveValue(80) // 3rd place overridden
		})

		it("shows visual indicator for overridden values", () => {
			renderEditor({
				baseTemplate: "traditional",
				overrides: { "1": 150 },
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			// The first row should have an override indicator
			const firstRow = screen.getByTestId("points-row-1")
			expect(firstRow).toHaveClass("bg-accent")
		})

		it("shows reset button for overridden values", () => {
			renderEditor({
				baseTemplate: "traditional",
				overrides: { "1": 150 },
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			// Should have a reset button for the overridden row
			const resetButton = screen.getByTestId("reset-row-1")
			expect(resetButton).toBeInTheDocument()
		})
	})

	describe("Editing Values", () => {
		it("calls onChange when a value is modified", () => {
			const onChange = vi.fn()
			renderEditor({
				baseTemplate: "traditional",
				overrides: {},
				onChange,
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			const inputs = screen.getAllByRole("spinbutton")
			fireEvent.change(inputs[0], { target: { value: "150" } })
			fireEvent.blur(inputs[0])

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({ "1": 150 }),
			)
		})

		it("removes override when value is reset to default", () => {
			const onChange = vi.fn()
			renderEditor({
				baseTemplate: "traditional",
				overrides: { "1": 150 },
				onChange,
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			const resetButton = screen.getByTestId("reset-row-1")
			fireEvent.click(resetButton)

			// Should call onChange with "1" removed from overrides
			expect(onChange).toHaveBeenCalledWith({})
		})

		it("does not create override when value matches default", () => {
			const onChange = vi.fn()
			renderEditor({
				baseTemplate: "traditional",
				traditionalConfig: { step: 5, firstPlacePoints: 100 },
				overrides: {},
				onChange,
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			const inputs = screen.getAllByRole("spinbutton")
			// The input already has 100 as default, so clearing and typing 100
			// should not create an override
			fireEvent.change(inputs[0], { target: { value: "100" } })
			fireEvent.blur(inputs[0])

			// Should not create an override for a value that matches default
			expect(onChange).not.toHaveBeenCalled()
		})
	})

	describe("Bulk Actions", () => {
		it("has a Reset All button", () => {
			renderEditor({
				baseTemplate: "traditional",
				overrides: { "1": 150, "2": 90 },
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			expect(
				screen.getByRole("button", { name: /reset all/i }),
			).toBeInTheDocument()
		})

		it("resets all overrides when Reset All is clicked", () => {
			const onChange = vi.fn()
			renderEditor({
				baseTemplate: "traditional",
				overrides: { "1": 150, "2": 90, "5": 50 },
				onChange,
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)
			fireEvent.click(screen.getByRole("button", { name: /reset all/i }))

			expect(onChange).toHaveBeenCalledWith({})
		})
	})

	describe("Template Preview", () => {
		it("shows template name in header", () => {
			renderEditor({ baseTemplate: "winner_takes_more" })

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			// Check the badge specifically contains the template name
			expect(
				screen.getByRole("heading", { name: /custom points table/i }),
			).toBeInTheDocument()
			// There should be multiple matches for "Winner Takes More" (badge + description)
			expect(screen.getAllByText(/winner takes more/i).length).toBeGreaterThan(
				0,
			)
		})

		it("shows override count badge when overrides exist", () => {
			renderEditor({
				baseTemplate: "traditional",
				overrides: { "1": 150, "2": 90 },
			})

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			expect(screen.getByText(/2 custom/i)).toBeInTheDocument()
		})
	})

	describe("Accessibility", () => {
		it("inputs have proper labels", () => {
			renderEditor()

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)

			// Each input should be labeled with its place (use exact match to avoid matching 10, 11, etc)
			expect(screen.getByLabelText("Points for place 1")).toBeInTheDocument()
			expect(screen.getByLabelText("Points for place 2")).toBeInTheDocument()
		})

		it("dialog can be closed with close button", () => {
			renderEditor()

			fireEvent.click(
				screen.getByRole("button", { name: /edit points table/i }),
			)
			expect(screen.getByRole("dialog")).toBeInTheDocument()

			fireEvent.click(screen.getByRole("button", { name: /done/i }))
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		})
	})
})
