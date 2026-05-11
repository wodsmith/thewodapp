import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RefundStatusBadge } from "@/routes/compete/organizer/$competitionId/-components/refund-status-badge"

// Mock lucide-react icons as simple spans (matches pattern from sibling tests)
vi.mock("lucide-react", () => {
	const icon =
		(name: string) =>
		({ className }: { className?: string }) => (
			<span data-testid={`icon-${name}`} className={className} />
		)
	return {
		RotateCcw: icon("rotate-ccw"),
	}
})

describe("RefundStatusBadge", () => {
	it("renders nothing when there is no refund", () => {
		const { container } = render(
			<RefundStatusBadge refundedCents={0} totalCents={10000} />,
		)
		expect(container).toBeEmptyDOMElement()
	})

	it("renders 'Refunded' when refunded amount equals total", () => {
		render(<RefundStatusBadge refundedCents={10000} totalCents={10000} />)
		expect(screen.getByText("Refunded")).toBeInTheDocument()
	})

	it("renders 'Refunded' when refunded amount exceeds total (defensive)", () => {
		// Should never happen in practice (the refund flow rejects over-refund),
		// but the badge should still degrade to "Refunded" rather than
		// "Partially refunded" if it ever does.
		render(<RefundStatusBadge refundedCents={11000} totalCents={10000} />)
		expect(screen.getByText("Refunded")).toBeInTheDocument()
	})

	it("renders 'Partially refunded' when refunded amount is less than total", () => {
		render(<RefundStatusBadge refundedCents={3000} totalCents={10000} />)
		expect(screen.getByText(/Partially refunded/i)).toBeInTheDocument()
	})

	it("includes the refunded amount in the partial badge", () => {
		// Organizers need to see how much has been refunded, not just that
		// some refund happened — otherwise they'd have to click into the
		// purchase to find out.
		render(<RefundStatusBadge refundedCents={3000} totalCents={10000} />)
		expect(screen.getByText(/\$30\.00/)).toBeInTheDocument()
	})
})
