import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import type { FinancialEventType } from "@/db/ps-schema"
import { cn } from "@/utils/cn"
import { EventTypeBadge } from "./event-type-badge"
import type { getPurchaseEvents } from "@/server-fns/financial-events"

type PurchaseEventsData = Awaited<ReturnType<typeof getPurchaseEvents>>

interface PurchaseGroupTableProps {
	data: PurchaseEventsData | null
	isLoading: boolean
}

function formatCents(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100)
}

function formatDate(date: Date | string): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	})
}

const statusColors: Record<string, string> = {
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	refunded:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
}

export function PurchaseGroupTable({
	data,
	isLoading,
}: PurchaseGroupTableProps) {
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

	function toggleRow(purchaseId: string) {
		setExpandedRows((prev) => {
			const next = new Set(prev)
			if (next.has(purchaseId)) {
				next.delete(purchaseId)
			} else {
				next.add(purchaseId)
			}
			return next
		})
	}

	if (isLoading) {
		return (
			<div className="flex h-48 items-center justify-center text-muted-foreground">
				Loading purchases...
			</div>
		)
	}

	if (!data || data.purchases.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center text-muted-foreground">
				No purchase data found.
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div className="rounded-md border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/50">
							<th className="h-10 w-10 px-2" />
							<th className="h-10 px-4 text-left font-medium text-muted-foreground">
								Purchase ID
							</th>
							<th className="h-10 px-4 text-left font-medium text-muted-foreground">
								Total
							</th>
							<th className="h-10 px-4 text-left font-medium text-muted-foreground">
								Net Balance
							</th>
							<th className="h-10 px-4 text-left font-medium text-muted-foreground">
								Events
							</th>
							<th className="h-10 px-4 text-left font-medium text-muted-foreground">
								Status
							</th>
							<th className="h-10 px-4 text-left font-medium text-muted-foreground">
								Mismatch
							</th>
						</tr>
					</thead>
					<tbody>
						{data.purchases.map((group) => {
							const purchaseId =
								group.purchase?.id ?? group.events[0]?.purchaseId ?? "unknown"
							const isExpanded = expandedRows.has(purchaseId)

							return (
								<PurchaseRow
									key={purchaseId}
									group={group}
									purchaseId={purchaseId}
									isExpanded={isExpanded}
									onToggle={() => toggleRow(purchaseId)}
								/>
							)
						})}
					</tbody>
				</table>
			</div>

			<div className="text-xs text-muted-foreground">
				Showing {data.purchases.length} of {data.total} purchase
				{data.total !== 1 ? "s" : ""} (page {data.page} of{" "}
				{data.totalPages})
			</div>
		</div>
	)
}

function PurchaseRow({
	group,
	purchaseId,
	isExpanded,
	onToggle,
}: {
	group: PurchaseEventsData["purchases"][number]
	purchaseId: string
	isExpanded: boolean
	onToggle: () => void
}) {
	const { purchase, events, netBalance, isMismatched } = group
	const status = purchase?.status ?? "unknown"

	return (
		<>
			<tr
				className={cn(
					"border-b transition-colors hover:bg-muted/50 cursor-pointer",
					isMismatched && "bg-red-50 dark:bg-red-950/20",
				)}
				onClick={onToggle}
			>
				<td className="px-2 py-3 text-center">
					{isExpanded ? (
						<ChevronDown className="inline h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="inline h-4 w-4 text-muted-foreground" />
					)}
				</td>
				<td className="px-4 py-3 font-mono text-xs">
					{purchaseId.length > 16
						? `${purchaseId.slice(0, 8)}...${purchaseId.slice(-8)}`
						: purchaseId}
				</td>
				<td className="px-4 py-3">
					{formatCents(purchase?.totalCents ?? 0)}
				</td>
				<td className="px-4 py-3">{formatCents(netBalance)}</td>
				<td className="px-4 py-3">{events.length}</td>
				<td className="px-4 py-3">
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
							statusColors[status] ||
								"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
						)}
					>
						{status}
					</span>
				</td>
				<td className="px-4 py-3">
					{isMismatched && (
						<AlertTriangle className="inline h-4 w-4 text-red-500" />
					)}
				</td>
			</tr>
			{isExpanded && (
				<tr className="border-b">
					<td colSpan={7} className="p-0">
						<div className="bg-muted/30 px-8 py-3">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-muted">
										<th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
											Event Type
										</th>
										<th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
											Amount
										</th>
										<th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
											Reason
										</th>
										<th className="pb-2 text-left text-xs font-medium text-muted-foreground">
											Date
										</th>
									</tr>
								</thead>
								<tbody>
									{events.map((event) => (
										<tr
											key={event.id}
											className="border-b border-muted/50 last:border-0"
										>
											<td className="py-2 pr-4">
												<EventTypeBadge
													eventType={
														event.eventType as FinancialEventType
													}
												/>
											</td>
											<td className="py-2 pr-4">
												{formatCents(event.amountCents)}
											</td>
											<td className="py-2 pr-4 text-muted-foreground">
												{event.reason ?? "-"}
											</td>
											<td className="py-2 text-muted-foreground">
												{formatDate(event.createdAt)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}
