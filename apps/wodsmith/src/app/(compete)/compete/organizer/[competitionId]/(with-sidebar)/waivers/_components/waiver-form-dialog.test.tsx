import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Waiver } from "@/db/schemas/waivers"
import { WaiverFormDialog } from "./waiver-form-dialog"

// Mock ResizeObserver for Radix Dialog
class MockResizeObserver {
	observe = vi.fn()
	unobserve = vi.fn()
	disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Mock the waiver actions
vi.mock("@/actions/waivers", () => ({
	createWaiverAction: vi.fn(),
	updateWaiverAction: vi.fn(),
}))

// Mock WaiversEditor
vi.mock("@/components/compete/waivers-editor", () => ({
	WaiversEditor: ({
		value,
		onChange,
		placeholder,
	}: {
		value: unknown
		onChange: (value: unknown) => void
		placeholder: string
	}) => (
		<textarea
			data-testid="waivers-editor"
			placeholder={placeholder}
			value={value ? JSON.stringify(value) : ""}
			onChange={(e) => {
				try {
					onChange(JSON.parse(e.target.value))
				} catch {
					// Invalid JSON, ignore
				}
			}}
		/>
	),
}))

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}))

const mockWaiver: Waiver = {
	id: "waiv_123",
	competitionId: "comp_123",
	title: "Liability Waiver",
	content: JSON.stringify({ root: { children: [] } }),
	required: true,
	position: 0,
	createdAt: new Date(),
	updatedAt: new Date(),
	updateCounter: 0,
}

describe("WaiverFormDialog", () => {
	it("renders create dialog with empty form", () => {
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		expect(screen.getByText("Add Waiver")).toBeInTheDocument()
		expect(
			screen.getByText("Create a new waiver for athletes to sign"),
		).toBeInTheDocument()
		expect(screen.getByLabelText("Title")).toHaveValue("")
		expect(screen.getByTestId("waivers-editor")).toHaveValue("")
		expect(
			screen.getByRole("checkbox", {
				name: /Required \(athletes must sign to register\)/i,
			}),
		).toBeChecked()
		expect(screen.getByRole("button", { name: "Create Waiver" })).toBeEnabled()
	})

	it("renders edit dialog with pre-filled form", () => {
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				waiver={mockWaiver}
				onSuccess={onSuccess}
			/>,
		)

		expect(screen.getByText("Edit Waiver")).toBeInTheDocument()
		expect(
			screen.getByText("Update waiver details and content"),
		).toBeInTheDocument()
		expect(screen.getByLabelText("Title")).toHaveValue("Liability Waiver")
		expect(screen.getByTestId("waivers-editor")).toHaveValue(
			JSON.stringify({ root: { children: [] } }),
		)
		expect(
			screen.getByRole("checkbox", {
				name: /Required \(athletes must sign to register\)/i,
			}),
		).toBeChecked()
		expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled()
	})

	it("shows validation error when title is empty", async () => {
		const { toast } = await import("sonner")
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		const submitButton = screen.getByRole("button", { name: "Create Waiver" })

		// Add content but leave title empty
		const editor = screen.getByTestId("waivers-editor")
		await user.click(editor)
		await user.paste(JSON.stringify({ root: { children: [] } }))

		await user.click(submitButton)

		expect(toast.error).toHaveBeenCalledWith("Title is required")
		expect(onSuccess).not.toHaveBeenCalled()
	})

	it("shows validation error when content is empty", async () => {
		const { toast } = await import("sonner")
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		const titleInput = screen.getByLabelText("Title")
		const submitButton = screen.getByRole("button", { name: "Create Waiver" })

		await user.type(titleInput, "Test Waiver")
		await user.click(submitButton)

		expect(toast.error).toHaveBeenCalledWith("Content is required")
		expect(onSuccess).not.toHaveBeenCalled()
	})

	it("creates waiver successfully", async () => {
		const { createWaiverAction } = await import("@/actions/waivers")
		const { toast } = await import("sonner")
		const mockCreate = vi.mocked(createWaiverAction)
		const createdWaiver: Waiver = {
			...mockWaiver,
			id: "waiv_new",
			title: "New Waiver",
		}
		mockCreate.mockResolvedValue([
			// @ts-expect-error - mocking return type
			{ data: createdWaiver },
			null,
		])

		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		const titleInput = screen.getByLabelText("Title")
		const editor = screen.getByTestId("waivers-editor")
		const submitButton = screen.getByRole("button", { name: "Create Waiver" })

		await user.type(titleInput, "New Waiver")
		await user.click(editor)
		await user.paste(JSON.stringify({ root: { children: [] } }))
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockCreate).toHaveBeenCalledWith({
				competitionId: "comp_123",
				teamId: "team_123",
				title: "New Waiver",
				content: JSON.stringify({ root: { children: [] } }),
				required: true,
			})
			expect(toast.success).toHaveBeenCalledWith("Waiver created")
			expect(onSuccess).toHaveBeenCalledWith(createdWaiver)
		})
	})

	it("updates waiver successfully", async () => {
		const { updateWaiverAction } = await import("@/actions/waivers")
		const { toast } = await import("sonner")
		const mockUpdate = vi.mocked(updateWaiverAction)
		const updatedWaiver: Waiver = {
			...mockWaiver,
			title: "Updated Waiver",
		}
		mockUpdate.mockResolvedValue([
			// @ts-expect-error - mocking return type
			{ data: updatedWaiver },
			null,
		])

		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				waiver={mockWaiver}
				onSuccess={onSuccess}
			/>,
		)

		const titleInput = screen.getByLabelText("Title")
		const submitButton = screen.getByRole("button", { name: "Save Changes" })

		await user.clear(titleInput)
		await user.type(titleInput, "Updated Waiver")
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockUpdate).toHaveBeenCalledWith({
				waiverId: "waiv_123",
				competitionId: "comp_123",
				teamId: "team_123",
				title: "Updated Waiver",
				content: JSON.stringify({ root: { children: [] } }),
				required: true,
			})
			expect(toast.success).toHaveBeenCalledWith("Waiver updated")
			expect(onSuccess).toHaveBeenCalledWith(updatedWaiver)
		})
	})

	it("handles create error", async () => {
		const { createWaiverAction } = await import("@/actions/waivers")
		const { toast } = await import("sonner")
		const mockCreate = vi.mocked(createWaiverAction)
		mockCreate.mockResolvedValue([
			null,
			// @ts-expect-error - mocking error type
			{ code: "ERROR", message: "Failed to create" },
		])

		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		const titleInput = screen.getByLabelText("Title")
		const editor = screen.getByTestId("waivers-editor")
		const submitButton = screen.getByRole("button", { name: "Create Waiver" })

		await user.type(titleInput, "New Waiver")
		await user.click(editor)
		await user.paste(JSON.stringify({ root: { children: [] } }))
		await user.click(submitButton)

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Failed to create waiver")
			expect(onSuccess).not.toHaveBeenCalled()
		})
	})

	it("handles update error", async () => {
		const { updateWaiverAction } = await import("@/actions/waivers")
		const { toast } = await import("sonner")
		const mockUpdate = vi.mocked(updateWaiverAction)
		mockUpdate.mockResolvedValue([
			null,
			// @ts-expect-error - mocking error type
			{ code: "ERROR", message: "Failed to update" },
		])

		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				waiver={mockWaiver}
				onSuccess={onSuccess}
			/>,
		)

		const submitButton = screen.getByRole("button", { name: "Save Changes" })
		await user.click(submitButton)

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Failed to update waiver")
			expect(onSuccess).not.toHaveBeenCalled()
		})
	})

	it("allows toggling required checkbox", async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		const requiredCheckbox = screen.getByRole("checkbox", {
			name: /Required \(athletes must sign to register\)/i,
		})

		expect(requiredCheckbox).toBeChecked()

		await user.click(requiredCheckbox)
		expect(requiredCheckbox).not.toBeChecked()

		await user.click(requiredCheckbox)
		expect(requiredCheckbox).toBeChecked()
	})

	it("closes dialog when cancel is clicked", async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		const cancelButton = screen.getByRole("button", { name: "Cancel" })
		await user.click(cancelButton)

		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it("disables form during submission", async () => {
		const { createWaiverAction } = await import("@/actions/waivers")
		const mockCreate = vi.mocked(createWaiverAction)
		// Make the action hang so we can check loading state
		mockCreate.mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(
						() =>
							resolve([
								// @ts-expect-error - mocking return type
								{ data: mockWaiver },
								null,
							]),
						100,
					)
				}),
		)

		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSuccess = vi.fn()

		render(
			<WaiverFormDialog
				open={true}
				onOpenChange={onOpenChange}
				competitionId="comp_123"
				teamId="team_123"
				onSuccess={onSuccess}
			/>,
		)

		const titleInput = screen.getByLabelText("Title")
		const editor = screen.getByTestId("waivers-editor")
		const submitButton = screen.getByRole("button", { name: "Create Waiver" })
		const cancelButton = screen.getByRole("button", { name: "Cancel" })

		await user.type(titleInput, "New Waiver")
		await user.click(editor)
		await user.paste(JSON.stringify({ root: { children: [] } }))
		await user.click(submitButton)

		// During submission, form should be disabled
		expect(submitButton).toHaveTextContent("Saving...")
		expect(titleInput).toBeDisabled()
		expect(cancelButton).toBeDisabled()

		// Wait for submission to complete
		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalled()
		})
	})
})
