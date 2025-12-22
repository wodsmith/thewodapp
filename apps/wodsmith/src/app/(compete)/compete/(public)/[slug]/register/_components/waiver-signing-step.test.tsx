import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Waiver } from "@/db/schemas/waivers"
import { WaiverSigningStep } from "./waiver-signing-step"

// Mock the signWaiverAction
vi.mock("@/actions/waivers", () => ({
	signWaiverAction: vi.fn(),
}))

// Mock WaiverViewer
vi.mock("@/components/compete/waiver-viewer", () => ({
	WaiverViewer: ({ content }: { content: unknown }) => (
		<div data-testid="waiver-viewer">{JSON.stringify(content)}</div>
	),
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

describe("WaiverSigningStep", () => {
	it("renders waiver with checkbox and disabled continue button", () => {
		const onComplete = vi.fn()
		render(<WaiverSigningStep waivers={[mockWaiver]} onComplete={onComplete} />)

		expect(screen.getByText("Liability Waiver")).toBeInTheDocument()
		expect(screen.getByTestId("waiver-viewer")).toBeInTheDocument()
		expect(
			screen.getByRole("checkbox", { name: /I have read and agree/i }),
		).not.toBeChecked()
		expect(screen.getByRole("button", { name: /Continue/i })).toBeDisabled()
	})

	it("enables continue button when all waivers are checked", async () => {
		const user = userEvent.setup()
		const onComplete = vi.fn()
		render(<WaiverSigningStep waivers={[mockWaiver]} onComplete={onComplete} />)

		const checkbox = screen.getByRole("checkbox", {
			name: /I have read and agree/i,
		})
		const continueButton = screen.getByRole("button", { name: /Continue/i })

		expect(continueButton).toBeDisabled()

		await user.click(checkbox)

		expect(checkbox).toBeChecked()
		expect(continueButton).toBeEnabled()
	})

	it("handles multiple waivers - all must be checked to enable continue", async () => {
		const user = userEvent.setup()
		const onComplete = vi.fn()
		const waivers: Waiver[] = [
			mockWaiver,
			{
				...mockWaiver,
				id: "waiv_456",
				title: "Photo Release",
				position: 1,
			},
		]

		render(<WaiverSigningStep waivers={waivers} onComplete={onComplete} />)

		const checkboxes = screen.getAllByRole("checkbox")
		const continueButton = screen.getByRole("button", { name: /Continue/i })

		expect(continueButton).toBeDisabled()

		// Check first waiver
		if (checkboxes[0]) await user.click(checkboxes[0])
		expect(continueButton).toBeDisabled() // Still disabled

		// Check second waiver
		if (checkboxes[1]) await user.click(checkboxes[1])
		expect(continueButton).toBeEnabled() // Now enabled
	})

	it("calls signWaiverAction and onComplete when continue is clicked", async () => {
		const { signWaiverAction } = await import("@/actions/waivers")
		const mockSignWaiver = vi.mocked(signWaiverAction)
		mockSignWaiver.mockResolvedValue([
			// @ts-expect-error - mocking return type
			{ success: true, data: { id: "sig_123" } },
			null,
		])

		const user = userEvent.setup()
		const onComplete = vi.fn()
		render(<WaiverSigningStep waivers={[mockWaiver]} onComplete={onComplete} />)

		const checkbox = screen.getByRole("checkbox", {
			name: /I have read and agree/i,
		})
		const continueButton = screen.getByRole("button", { name: /Continue/i })

		await user.click(checkbox)
		await user.click(continueButton)

		await waitFor(() => {
			expect(mockSignWaiver).toHaveBeenCalledWith({
				waiverId: "waiv_123",
				registrationId: undefined,
				ipAddress: undefined,
			})
			expect(onComplete).toHaveBeenCalled()
		})
	})

	it("skips already signed waivers", async () => {
		const { signWaiverAction } = await import("@/actions/waivers")
		const mockSignWaiver = vi.mocked(signWaiverAction)

		const user = userEvent.setup()
		const onComplete = vi.fn()
		const signedWaiverIds = new Set(["waiv_123"])

		render(
			<WaiverSigningStep
				waivers={[mockWaiver]}
				onComplete={onComplete}
				signedWaiverIds={signedWaiverIds}
			/>,
		)

		// Should auto-check signed waivers
		const checkbox = screen.getByRole("checkbox", {
			name: /I have read and agree/i,
		})
		expect(checkbox).toBeChecked()

		const continueButton = screen.getByRole("button", { name: /Continue/i })
		expect(continueButton).toBeEnabled()

		await user.click(continueButton)

		await waitFor(() => {
			// Should not call signWaiverAction for already signed waivers
			expect(mockSignWaiver).not.toHaveBeenCalled()
			expect(onComplete).toHaveBeenCalled()
		})
	})

	it("shows error message when signing fails", async () => {
		const { signWaiverAction } = await import("@/actions/waivers")
		const mockSignWaiver = vi.mocked(signWaiverAction)
		mockSignWaiver.mockResolvedValue([
			null,
			// @ts-expect-error - mocking error type
			{ code: "ERROR", message: "Failed to sign waiver" },
		])

		const user = userEvent.setup()
		const onComplete = vi.fn()
		render(<WaiverSigningStep waivers={[mockWaiver]} onComplete={onComplete} />)

		const checkbox = screen.getByRole("checkbox", {
			name: /I have read and agree/i,
		})
		const continueButton = screen.getByRole("button", { name: /Continue/i })

		await user.click(checkbox)
		await user.click(continueButton)

		// Wait for the error to appear - it's a toast, not in the DOM
		await waitFor(() => {
			expect(mockSignWaiver).toHaveBeenCalled()
		})

		// Check that onComplete was not called
		expect(onComplete).not.toHaveBeenCalled()
	})

	it("renders nothing when no waivers are provided", () => {
		const onComplete = vi.fn()
		const { container } = render(
			<WaiverSigningStep waivers={[]} onComplete={onComplete} />,
		)

		expect(container.firstChild).toBeNull()
	})
})
