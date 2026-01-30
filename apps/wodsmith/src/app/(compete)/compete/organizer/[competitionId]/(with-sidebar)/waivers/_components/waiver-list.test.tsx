import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Waiver } from "@/db/schemas/waivers"
import { WaiverList } from "./waiver-list"

// Mock the waiver actions
vi.mock("@/actions/waivers", () => ({
	deleteWaiverAction: vi.fn(),
	reorderWaiversAction: vi.fn(),
	createWaiverAction: vi.fn(),
	updateWaiverAction: vi.fn(),
}))

// Mock WaiverFormDialog
vi.mock("./waiver-form-dialog", () => ({
	WaiverFormDialog: ({
		open,
		waiver,
		onSuccess,
	}: {
		open: boolean
		onOpenChange: (open: boolean) => void
		waiver?: Waiver
		onSuccess: (waiver: Waiver) => void
	}) =>
		open ? (
			<div data-testid="waiver-form-dialog">
				<p>Mock Dialog: {waiver ? "Edit" : "Create"}</p>
				<button
					type="button"
					onClick={() => {
						const mockWaiver: Waiver = {
							id: waiver?.id ?? "waiv_new",
							competitionId: "comp_123",
							title: waiver ? "Updated Waiver" : "New Waiver",
							content: JSON.stringify({ root: { children: [] } }),
							required: true,
							position: waiver?.position ?? 0,
							createdAt: new Date(),
							updatedAt: new Date(),
							updateCounter: 0,
						}
						onSuccess(mockWaiver)
					}}
				>
					Submit
				</button>
			</div>
		) : null,
}))

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}))

// Mock drag and drop dependencies
vi.mock("@atlaskit/pragmatic-drag-and-drop/combine", () => ({
	combine: vi.fn(() => vi.fn()),
}))

vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
	draggable: vi.fn(),
	dropTargetForElements: vi.fn(),
}))

vi.mock(
	"@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview",
	() => ({
		pointerOutsideOfPreview: vi.fn(),
	}),
)

vi.mock(
	"@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview",
	() => ({
		setCustomNativeDragPreview: vi.fn(),
	}),
)

vi.mock("@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge", () => ({
	attachClosestEdge: vi.fn(),
	extractClosestEdge: vi.fn(),
}))

vi.mock("@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box", () => ({
	DropIndicator: () => <div data-testid="drop-indicator" />,
}))

const createMockWaiver = (overrides: Partial<Waiver> = {}): Waiver => ({
	id: "waiv_123",
	competitionId: "comp_123",
	title: "Liability Waiver",
	content: JSON.stringify({ root: { children: [] } }),
	required: true,
	position: 0,
	createdAt: new Date(),
	updatedAt: new Date(),
	updateCounter: 0,
	...overrides,
})

describe("WaiverList", () => {
	it("renders empty state when no waivers", () => {
		render(
			<WaiverList competitionId="comp_123" teamId="team_123" waivers={[]} />,
		)

		expect(screen.getByText("No waivers yet")).toBeInTheDocument()
		expect(
			screen.getByText(
				"Create your first waiver to require athletes to sign liability agreements",
			),
		).toBeInTheDocument()
		// Two "Add Waiver" buttons: one in header, one in empty state
		expect(screen.getAllByRole("button", { name: /Add Waiver/i })).toHaveLength(
			2,
		)
	})

	it("renders list of waivers", () => {
		const waivers = [
			createMockWaiver({
				id: "waiv_1",
				title: "Liability Waiver",
				position: 0,
			}),
			createMockWaiver({
				id: "waiv_2",
				title: "Photo Release",
				position: 1,
				required: false,
			}),
		]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		expect(screen.getByText("Liability Waiver")).toBeInTheDocument()
		expect(screen.getByText("Photo Release")).toBeInTheDocument()
		expect(screen.getByText("Position 1")).toBeInTheDocument()
		expect(screen.getByText("Position 2")).toBeInTheDocument()
	})

	it("shows required badge for required waivers", () => {
		const waivers = [
			createMockWaiver({
				id: "waiv_1",
				title: "Required Waiver",
				required: true,
			}),
			createMockWaiver({
				id: "waiv_2",
				title: "Optional Waiver",
				required: false,
			}),
		]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		// Check for required/optional badges (text appears in title and badge)
		const requiredTexts = screen.getAllByText(/Required/i)
		const optionalTexts = screen.getAllByText(/Optional/i)
		expect(requiredTexts.length).toBeGreaterThan(0)
		expect(optionalTexts.length).toBeGreaterThan(0)
	})

	it("opens create dialog when add button is clicked", async () => {
		const user = userEvent.setup()

		render(
			<WaiverList competitionId="comp_123" teamId="team_123" waivers={[]} />,
		)

		// Click the first "Add Waiver" button (in header)
		const addButtons = screen.getAllByRole("button", { name: /Add Waiver/i })
		if (addButtons[0]) await user.click(addButtons[0])

		expect(screen.getByTestId("waiver-form-dialog")).toBeInTheDocument()
		expect(screen.getByText("Mock Dialog: Create")).toBeInTheDocument()
	})

	it("opens edit dialog when edit button is clicked", async () => {
		const user = userEvent.setup()
		const waivers = [createMockWaiver({ title: "Liability Waiver" })]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		const editButton = screen.getByRole("button", {
			name: "Edit Liability Waiver",
		})
		await user.click(editButton)

		expect(screen.getByTestId("waiver-form-dialog")).toBeInTheDocument()
		expect(screen.getByText("Mock Dialog: Edit")).toBeInTheDocument()
	})

	it("adds new waiver to list when created", async () => {
		const user = userEvent.setup()

		render(
			<WaiverList competitionId="comp_123" teamId="team_123" waivers={[]} />,
		)

		const addButtons = screen.getAllByRole("button", { name: /Add Waiver/i })
		if (addButtons[0]) await user.click(addButtons[0])

		const submitButton = screen.getByRole("button", { name: "Submit" })
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText("New Waiver")).toBeInTheDocument()
		})
	})

	it("updates waiver in list when edited", async () => {
		const user = userEvent.setup()
		const waivers = [createMockWaiver({ title: "Original Waiver" })]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		const editButton = screen.getByRole("button", {
			name: "Edit Original Waiver",
		})
		await user.click(editButton)

		const submitButton = screen.getByRole("button", { name: "Submit" })
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText("Updated Waiver")).toBeInTheDocument()
			expect(screen.queryByText("Original Waiver")).not.toBeInTheDocument()
		})
	})

	it("opens delete confirmation dialog when delete button is clicked", async () => {
		const user = userEvent.setup()
		const waivers = [createMockWaiver({ title: "Liability Waiver" })]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		const deleteButton = screen.getByRole("button", {
			name: "Delete Liability Waiver",
		})
		await user.click(deleteButton)

		// AlertDialog should open
		expect(
			screen.getByRole("alertdialog", { name: /Delete Waiver/i }),
		).toBeInTheDocument()
		expect(
			screen.getByText(/Are you sure you want to delete this waiver\?/i),
		).toBeInTheDocument()
	})

	it("deletes waiver successfully", async () => {
		const { deleteWaiverAction } = await import("@/actions/waivers")
		const { toast } = await import("sonner")
		const mockDelete = vi.mocked(deleteWaiverAction)
		mockDelete.mockResolvedValue([{ success: true }, null])

		const user = userEvent.setup()
		const waivers = [createMockWaiver({ title: "Liability Waiver" })]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		const deleteButton = screen.getByRole("button", {
			name: "Delete Liability Waiver",
		})
		await user.click(deleteButton)

		const confirmButton = screen.getByRole("button", { name: /Delete/i })
		await user.click(confirmButton)

		await waitFor(() => {
			expect(mockDelete).toHaveBeenCalledWith({
				waiverId: "waiv_123",
				competitionId: "comp_123",
				teamId: "team_123",
			})
			expect(toast.success).toHaveBeenCalledWith("Waiver deleted")
			expect(screen.queryByText("Liability Waiver")).not.toBeInTheDocument()
		})
	})

	it("handles delete error", async () => {
		const { deleteWaiverAction } = await import("@/actions/waivers")
		const { toast } = await import("sonner")
		const mockDelete = vi.mocked(deleteWaiverAction)
		mockDelete.mockResolvedValue([
			null,
			// @ts-expect-error - mocking error type
			{ code: "ERROR", message: "Failed to delete" },
		])

		const user = userEvent.setup()
		const waivers = [createMockWaiver({ title: "Liability Waiver" })]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		const deleteButton = screen.getByRole("button", {
			name: "Delete Liability Waiver",
		})
		await user.click(deleteButton)

		const confirmButton = screen.getByRole("button", { name: /Delete/i })
		await user.click(confirmButton)

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Failed to delete waiver")
			// Waiver should still be in the list
			expect(screen.getByText("Liability Waiver")).toBeInTheDocument()
		})
	})

	it("cancels delete when cancel button is clicked", async () => {
		const { deleteWaiverAction } = await import("@/actions/waivers")
		const mockDelete = vi.mocked(deleteWaiverAction)

		const user = userEvent.setup()
		const waivers = [createMockWaiver({ title: "Liability Waiver" })]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		const deleteButton = screen.getByRole("button", {
			name: "Delete Liability Waiver",
		})
		await user.click(deleteButton)

		const cancelButton = screen.getByRole("button", { name: /Cancel/i })
		await user.click(cancelButton)

		expect(mockDelete).not.toHaveBeenCalled()
		expect(screen.getByText("Liability Waiver")).toBeInTheDocument()
	})

	it("renders drag handles for reordering", () => {
		const waivers = [createMockWaiver({ title: "Liability Waiver" })]

		render(
			<WaiverList
				competitionId="comp_123"
				teamId="team_123"
				waivers={waivers}
			/>,
		)

		expect(
			screen.getByRole("button", { name: "Drag to reorder" }),
		).toBeInTheDocument()
	})

	it("shows header with title and description", () => {
		render(
			<WaiverList competitionId="comp_123" teamId="team_123" waivers={[]} />,
		)

		expect(screen.getByText("Waivers")).toBeInTheDocument()
		expect(
			screen.getByText("Manage competition waivers and liability agreements"),
		).toBeInTheDocument()
	})
})
