import type { FinancialEventType } from "@/db/ps-schema"
import { cn } from "@/utils/cn"
import { EventTypeBadge } from "./event-type-badge"

interface MonthGroup {
	label: string
	totalAmountCents: number
	count: number
}

interface TeamGroup {
	label: string
	teamId: string
	totalAmountCents: number
	count: number
}

interface EventTypeGroup {
	label: string
	totalAmountCents: number
	count: number
}

interface FinancialSummaryProps {
	monthData: {
		groupBy: "month"
		groups: MonthGroup[]
	} | null
	teamData: {
		groupBy: "team"
		groups: TeamGroup[]
	} | null
	eventTypeData: {
		groupBy: "eventType"
		groups: EventTypeGroup[]
	} | null
	isLoading: boolean
}

function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

function amountColor(cents: number): string {
	if (cents > 0) return "text-green-600 dark:text-green-400"
	if (cents < 0) return "text-red-600 dark:text-red-400"
	return ""
}

function formatMonthLabel(label: string): string {
	const [year, month] = label.split("-")
	const date = new Date(Number(year), Number(month) - 1)
	return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function SectionCard({
	title,
	children,
}: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border bg-card p-4 shadow-sm">
			<h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
			{children}
		</div>
	)
}

function LoadingSkeleton() {
	return (
		<div className="animate-pulse space-y-2">
			<div className="h-4 w-3/4 rounded bg-muted" />
			<div className="h-4 w-1/2 rounded bg-muted" />
			<div className="h-4 w-2/3 rounded bg-muted" />
		</div>
	)
}

function EmptyState() {
	return (
		<p className="py-4 text-center text-sm text-muted-foreground">
			No data for this period
		</p>
	)
}

function MonthSection({
	data,
}: { data: FinancialSummaryProps["monthData"] }) {
	if (!data || data.groups.length === 0) return <EmptyState />

	const totalCents = data.groups.reduce((s, g) => s + g.totalAmountCents, 0)
	const totalCount = data.groups.reduce((s, g) => s + g.count, 0)

	return (
		<table className="w-full text-sm">
			<thead>
				<tr className="border-b bg-muted/50">
					<th className="h-8 px-3 text-left font-medium text-muted-foreground">
						Month
					</th>
					<th className="h-8 px-3 text-right font-medium text-muted-foreground">
						Net Amount
					</th>
					<th className="h-8 px-3 text-right font-medium text-muted-foreground">
						Transactions
					</th>
				</tr>
			</thead>
			<tbody>
				{data.groups.map((g) => (
					<tr
						key={g.label}
						className="border-b transition-colors hover:bg-muted/50"
					>
						<td className="px-3 py-2">{formatMonthLabel(g.label)}</td>
						<td className={cn("px-3 py-2 text-right font-mono", amountColor(g.totalAmountCents))}>
							{formatCents(g.totalAmountCents)}
						</td>
						<td className="px-3 py-2 text-right">{g.count}</td>
					</tr>
				))}
				<tr className="bg-muted/30 font-semibold">
					<td className="px-3 py-2">Total</td>
					<td className={cn("px-3 py-2 text-right font-mono", amountColor(totalCents))}>
						{formatCents(totalCents)}
					</td>
					<td className="px-3 py-2 text-right">{totalCount}</td>
				</tr>
			</tbody>
		</table>
	)
}

function TeamSection({
	data,
}: { data: FinancialSummaryProps["teamData"] }) {
	if (!data || data.groups.length === 0) return <EmptyState />

	const totalCents = data.groups.reduce((s, g) => s + g.totalAmountCents, 0)
	const totalCount = data.groups.reduce((s, g) => s + g.count, 0)

	return (
		<table className="w-full text-sm">
			<thead>
				<tr className="border-b bg-muted/50">
					<th className="h-8 px-3 text-left font-medium text-muted-foreground">
						Team
					</th>
					<th className="h-8 px-3 text-right font-medium text-muted-foreground">
						Net Amount
					</th>
					<th className="h-8 px-3 text-right font-medium text-muted-foreground">
						Transactions
					</th>
				</tr>
			</thead>
			<tbody>
				{data.groups.map((g) => (
					<tr
						key={g.teamId}
						className="border-b transition-colors hover:bg-muted/50"
					>
						<td className="px-3 py-2">{g.label}</td>
						<td className={cn("px-3 py-2 text-right font-mono", amountColor(g.totalAmountCents))}>
							{formatCents(g.totalAmountCents)}
						</td>
						<td className="px-3 py-2 text-right">{g.count}</td>
					</tr>
				))}
				<tr className="bg-muted/30 font-semibold">
					<td className="px-3 py-2">Total</td>
					<td className={cn("px-3 py-2 text-right font-mono", amountColor(totalCents))}>
						{formatCents(totalCents)}
					</td>
					<td className="px-3 py-2 text-right">{totalCount}</td>
				</tr>
			</tbody>
		</table>
	)
}

function EventTypeSection({
	data,
}: { data: FinancialSummaryProps["eventTypeData"] }) {
	if (!data || data.groups.length === 0) return <EmptyState />

	return (
		<table className="w-full text-sm">
			<thead>
				<tr className="border-b bg-muted/50">
					<th className="h-8 px-3 text-left font-medium text-muted-foreground">
						Event Type
					</th>
					<th className="h-8 px-3 text-right font-medium text-muted-foreground">
						Total Amount
					</th>
					<th className="h-8 px-3 text-right font-medium text-muted-foreground">
						Count
					</th>
				</tr>
			</thead>
			<tbody>
				{data.groups.map((g) => (
					<tr
						key={g.label}
						className="border-b transition-colors hover:bg-muted/50"
					>
						<td className="px-3 py-2">
							<EventTypeBadge eventType={g.label as FinancialEventType} />
						</td>
						<td className={cn("px-3 py-2 text-right font-mono", amountColor(g.totalAmountCents))}>
							{formatCents(g.totalAmountCents)}
						</td>
						<td className="px-3 py-2 text-right">{g.count}</td>
					</tr>
				))}
			</tbody>
		</table>
	)
}

export function FinancialSummary({
	monthData,
	teamData,
	eventTypeData,
	isLoading,
}: FinancialSummaryProps) {
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<SectionCard title="Revenue by Month">
				{isLoading ? <LoadingSkeleton /> : <MonthSection data={monthData} />}
			</SectionCard>

			<SectionCard title="Revenue by Team">
				{isLoading ? <LoadingSkeleton /> : <TeamSection data={teamData} />}
			</SectionCard>

			<SectionCard title="Event Type Breakdown">
				{isLoading ? (
					<LoadingSkeleton />
				) : (
					<EventTypeSection data={eventTypeData} />
				)}
			</SectionCard>
		</div>
	)
}
