import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RevenueStatsDisplay } from "@/routes/compete/organizer/$competitionId/-components/revenue-stats-display"
import type { CompetitionRevenueStats } from "@/server-fns/commerce-fns"

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
	}: {
		children: React.ReactNode
		to: string
	}) => <a href={to}>{children}</a>,
	useLocation: () => ({ pathname: "/" }),
}))

vi.mock("lucide-react", () => {
	const icon =
		(name: string) =>
		({ className }: { className?: string }) => (
			<span data-testid={`icon-${name}`} className={className} />
		)
	return {
		AlertCircle: icon("alert"),
		CreditCard: icon("credit-card"),
		DollarSign: icon("dollar"),
		RotateCcw: icon("rotate-ccw"),
		TrendingUp: icon("trending-up"),
		Users: icon("users"),
	}
})

const baseStats: CompetitionRevenueStats = {
	totalGrossCents: 30000,
	totalPlatformFeeCents: 1800,
	totalStripeFeeCents: 950,
	totalOrganizerNetCents: 27250,
	totalRefundedCents: 0,
	purchaseCount: 3,
	byDivision: [
		{
			divisionId: "div-rx",
			divisionLabel: "RX",
			purchaseCount: 2,
			registrationFeeCents: 10000,
			grossCents: 20000,
			platformFeeCents: 1200,
			stripeFeeCents: 630,
			organizerNetCents: 18170,
			refundedCents: 0,
		},
		{
			divisionId: "div-scaled",
			divisionLabel: "Scaled",
			purchaseCount: 1,
			registrationFeeCents: 10000,
			grossCents: 10000,
			platformFeeCents: 600,
			stripeFeeCents: 320,
			organizerNetCents: 9080,
			refundedCents: 0,
		},
	],
}

describe("RevenueStatsDisplay refund handling", () => {
	it("does not surface refund UI when there are no refunds", () => {
		render(<RevenueStatsDisplay stats={baseStats} />)
		// We use queryAllByText and assert the count is 0 — the column header
		// shouldn't even render until a refund happens, otherwise organizers
		// see a confusing zero-everywhere column on healthy competitions.
		expect(screen.queryByText(/^Refunds$/)).not.toBeInTheDocument()
	})

	it("renders a 'Refunds' column in the per-division table when there are refunds", () => {
		const stats: CompetitionRevenueStats = {
			...baseStats,
			totalRefundedCents: 5000,
			byDivision: [
				{...baseStats.byDivision[0]!, refundedCents: 5000},
				{...baseStats.byDivision[1]!, refundedCents: 0},
			],
		}
		render(<RevenueStatsDisplay stats={stats} />)
		expect(screen.getByRole("columnheader", { name: /Refunds/i })).toBeInTheDocument()
	})

	it("shows the refund amount per division row", () => {
		const stats: CompetitionRevenueStats = {
			...baseStats,
			totalRefundedCents: 5000,
			byDivision: [
				{...baseStats.byDivision[0]!, refundedCents: 5000},
				{...baseStats.byDivision[1]!, refundedCents: 0},
			],
		}
		render(<RevenueStatsDisplay stats={stats} />)
		const rxRow = screen.getByText("RX").closest("tr") as HTMLElement
		expect(rxRow).not.toBeNull()
		expect(within(rxRow).getByText(/-?\$50\.00/)).toBeInTheDocument()
	})

	it("subtracts refunds from the per-division Net cell", () => {
		// RX organizer net is $181.70 before refunds, $50 refunded → $131.70
		// after refunds. The Net column reflects the post-refund number so the
		// organizer doesn't have to compute it themselves.
		const stats: CompetitionRevenueStats = {
			...baseStats,
			totalRefundedCents: 5000,
			byDivision: [
				{...baseStats.byDivision[0]!, refundedCents: 5000},
				{...baseStats.byDivision[1]!, refundedCents: 0},
			],
		}
		render(<RevenueStatsDisplay stats={stats} />)
		const rxRow = screen.getByText("RX").closest("tr") as HTMLElement
		expect(within(rxRow).getByText("$131.70")).toBeInTheDocument()
	})

	it("subtracts refunds from the top-level Your Net Revenue card", () => {
		// $272.50 net pre-refund, $50 refunded → $222.50
		const stats: CompetitionRevenueStats = {
			...baseStats,
			totalRefundedCents: 5000,
			byDivision: [
				{...baseStats.byDivision[0]!, refundedCents: 5000},
				{...baseStats.byDivision[1]!, refundedCents: 0},
			],
		}
		render(<RevenueStatsDisplay stats={stats} />)
		// The post-refund net appears in two places (the summary card and the
		// fee breakdown card) so any > 0 is sufficient to pin the contract.
		expect(screen.getAllByText("$222.50").length).toBeGreaterThan(0)
	})

	it("renders a 'Refunds' line in the fee breakdown card", () => {
		const stats: CompetitionRevenueStats = {
			...baseStats,
			totalRefundedCents: 5000,
		}
		render(<RevenueStatsDisplay stats={stats} />)
		// Line label appears in the breakdown card alongside Stripe Processing
		// and Platform Fee.
		expect(screen.getAllByText(/Refunds/i).length).toBeGreaterThan(0)
	})
})
