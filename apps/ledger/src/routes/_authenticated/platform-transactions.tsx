import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { FinancialEventTable } from "@/components/financial-event-table"
import { FinancialSummary } from "@/components/financial-summary"
import {
	getFinancialEvents,
	getFinancialSummary,
	getPlatformRevenueSummary,
} from "@/server-fns/financial-events"
import { FINANCIAL_EVENT_TYPE } from "@/db/ps-schema"

const EVENT_TYPES = Object.values(FINANCIAL_EVENT_TYPE)

export const Route = createFileRoute("/_authenticated/platform-transactions")({
	loader: async () => {
		const [result, revenue, summaryMonth, summaryTeam, summaryEventType] =
			await Promise.all([
				getFinancialEvents({ data: { page: 1, pageSize: 50 } }),
				getPlatformRevenueSummary(),
				getFinancialSummary({ data: { groupBy: "month" } }),
				getFinancialSummary({ data: { groupBy: "team" } }),
				getFinancialSummary({ data: { groupBy: "eventType" } }),
			])
		return { result, revenue, summaryMonth, summaryTeam, summaryEventType }
	},
	component: PlatformTransactionsPage,
})

function PlatformTransactionsPage() {
	const {
		result: initialResult,
		revenue,
		summaryMonth,
		summaryTeam,
		summaryEventType,
	} = Route.useLoaderData()
	const [events, setEvents] = useState(initialResult.events)
	const [total, setTotal] = useState(initialResult.total)
	const [page, setPage] = useState(initialResult.page)
	const [totalPages, setTotalPages] = useState(initialResult.totalPages)
	const [loading, setLoading] = useState(false)

	// Filters
	const [eventType, setEventType] = useState("")
	const [startDate, setStartDate] = useState("")
	const [endDate, setEndDate] = useState("")

	const fetchEvents = async (opts?: {
		newPage?: number
		newEventType?: string
		newStartDate?: string
		newEndDate?: string
	}) => {
		setLoading(true)
		try {
			const result = await getFinancialEvents({
				data: {
					page: opts?.newPage ?? page,
					pageSize: 50,
					eventType: (opts?.newEventType ?? eventType) || undefined,
					startDate: (opts?.newStartDate ?? startDate) || undefined,
					endDate: (opts?.newEndDate ?? endDate) || undefined,
				},
			})
			setEvents(result.events)
			setTotal(result.total)
			setPage(result.page)
			setTotalPages(result.totalPages)
		} finally {
			setLoading(false)
		}
	}

	const handleEventTypeChange = (value: string) => {
		setEventType(value)
		setPage(1)
		fetchEvents({ newPage: 1, newEventType: value })
	}

	const handleStartDateChange = (value: string) => {
		setStartDate(value)
		setPage(1)
		fetchEvents({ newPage: 1, newStartDate: value })
	}

	const handleEndDateChange = (value: string) => {
		setEndDate(value)
		setPage(1)
		fetchEvents({ newPage: 1, newEndDate: value })
	}

	const handlePageChange = (newPage: number) => {
		setPage(newPage)
		fetchEvents({ newPage })
	}

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b">
				<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<img
								src="/wodsmith-logo-no-text.png"
								alt="WODsmith"
								width={28}
								height={28}
							/>
							<h1 className="text-lg font-semibold">WODsmith Ledger</h1>
						</div>
						<nav className="flex items-center gap-1">
							<Link
								to="/documents"
								className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent text-muted-foreground"
							>
								Documents
							</Link>
							<Link
								to="/platform-transactions"
								className="px-3 py-1.5 text-sm font-medium rounded-md bg-accent"
							>
								Transactions
							</Link>
						</nav>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl p-4 space-y-6">
				{/* Revenue Summary Cards */}
				<div className="grid grid-cols-4 gap-4">
					{([
						{ label: "Lifetime", cents: revenue.lifetime },
						{ label: "This Month", cents: revenue.month },
						{ label: "This Week", cents: revenue.week },
						{ label: "Today", cents: revenue.today },
					] as const).map((card) => (
						<div
							key={card.label}
							className="rounded-lg border bg-card p-4"
						>
							<p className="text-xs font-medium text-muted-foreground">
								{card.label}
							</p>
							<p className="mt-1 text-2xl font-semibold font-mono text-emerald-600 dark:text-emerald-400">
								{new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: "usd",
								}).format(card.cents / 100)}
							</p>
						</div>
					))}
				</div>

				{/* Summary */}
				<FinancialSummary
					monthData={summaryMonth as any}
					teamData={summaryTeam as any}
					eventTypeData={summaryEventType as any}
					isLoading={false}
				/>

				{/* Event Log */}
				<div className="space-y-4">
					<h2 className="text-sm font-semibold text-foreground">Event Log</h2>

					{/* Filters */}
					<div className="flex flex-wrap items-end gap-3">
						<div className="flex flex-col gap-1">
							<label
								htmlFor="event-type-filter"
								className="text-xs font-medium text-muted-foreground"
							>
								Event Type
							</label>
							<select
								id="event-type-filter"
								value={eventType}
								onChange={(e) => handleEventTypeChange(e.target.value)}
								className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<option value="">All types</option>
								{EVENT_TYPES.map((t) => (
									<option key={t} value={t}>
										{t.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label
								htmlFor="start-date-filter"
								className="text-xs font-medium text-muted-foreground"
							>
								From
							</label>
							<input
								id="start-date-filter"
								type="date"
								value={startDate}
								onChange={(e) => handleStartDateChange(e.target.value)}
								className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<label
								htmlFor="end-date-filter"
								className="text-xs font-medium text-muted-foreground"
							>
								To
							</label>
							<input
								id="end-date-filter"
								type="date"
								value={endDate}
								onChange={(e) => handleEndDateChange(e.target.value)}
								className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							/>
						</div>
					</div>

					{/* Table */}
					<FinancialEventTable events={events} loading={loading} />

					{/* Pagination */}
					<div className="flex items-center justify-between">
						<span className="text-xs text-muted-foreground">
							{total} event{total !== 1 ? "s" : ""} total
						</span>
						{totalPages > 1 && (
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => handlePageChange(page - 1)}
									disabled={page <= 1}
									className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
								>
									Previous
								</button>
								<span className="text-sm text-muted-foreground">
									Page {page} of {totalPages}
								</span>
								<button
									type="button"
									onClick={() => handlePageChange(page + 1)}
									disabled={page >= totalPages}
									className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
								>
									Next
								</button>
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	)
}
