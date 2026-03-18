import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, Copy, Check } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/utils/cn"

type EventRow = {
	id: string
	purchaseId: string
	teamId: string
	teamName: string | null
	eventType: string
	amountCents: number
	currency: string
	stripePaymentIntentId: string | null
	stripeRefundId: string | null
	stripeDisputeId: string | null
	reason: string | null
	metadata: string | null
	actorId: string | null
	stripeEventTimestamp: Date | null
	createdAt: Date
}

function formatCurrency(cents: number, currency: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100)
}

function formatDate(date: Date | null): string {
	if (!date) return "-"
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	})
}

function truncate(str: string, len: number): string {
	if (str.length <= len) return str
	return `${str.slice(0, len)}...`
}

function parseMetaField(raw: string | null, field: string): number | null {
	if (!raw) return null
	try {
		const meta = JSON.parse(raw)
		const val = meta[field]
		return typeof val === "number" ? val : null
	} catch {
		return null
	}
}

const eventTypeColors: Record<string, string> = {
	PAYMENT_COMPLETED:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	PAYMENT_FAILED:
		"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	REFUND_INITIATED:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	REFUND_COMPLETED:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	REFUND_FAILED:
		"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	DISPUTE_OPENED:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	DISPUTE_WON:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	DISPUTE_LOST:
		"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	PAYOUT_INITIATED:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	PAYOUT_COMPLETED:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	PAYOUT_FAILED:
		"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	MANUAL_ADJUSTMENT:
		"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
}

function EventTypeBadgeInline({ eventType }: { eventType: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
				eventTypeColors[eventType] ??
					"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
			)}
		>
			{eventType.replace(/_/g, " ")}
		</span>
	)
}

function CopyButton({ value }: { value: string }) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		await navigator.clipboard.writeText(value)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
			title={value}
		>
			<span className="font-mono">{truncate(value, 12)}</span>
			{copied ? (
				<Check className="h-3 w-3 text-green-500" />
			) : (
				<Copy className="h-3 w-3" />
			)}
		</button>
	)
}

interface FinancialEventTableProps {
	events: EventRow[]
	loading?: boolean
}

export function FinancialEventTable({
	events,
	loading,
}: FinancialEventTableProps) {
	const [sorting, setSorting] = useState<SortingState>([])

	const columns = useMemo<ColumnDef<EventRow>[]>(
		() => [
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
					>
						Date
						<ArrowUpDown className="h-3.5 w-3.5" />
					</button>
				),
				cell: ({ row }) => (
					<span className="text-sm whitespace-nowrap">
						{formatDate(row.getValue("createdAt"))}
					</span>
				),
			},
			{
				accessorKey: "eventType",
				header: "Event Type",
				cell: ({ row }) => (
					<EventTypeBadgeInline eventType={row.getValue("eventType")} />
				),
			},
			{
				accessorKey: "amountCents",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
					>
						Amount
						<ArrowUpDown className="h-3.5 w-3.5" />
					</button>
				),
				cell: ({ row }) => {
					const cents = row.getValue("amountCents") as number
					const isPositive = cents > 0
					return (
						<span
							className={cn(
								"font-mono text-sm font-medium",
								isPositive
									? "text-green-600 dark:text-green-400"
									: "text-red-600 dark:text-red-400",
							)}
						>
							{isPositive ? "+" : ""}
							{formatCurrency(cents, row.original.currency)}
						</span>
					)
				},
			},
			{
				id: "platformFee",
				header: "Platform",
				cell: ({ row }) => {
					const cents = parseMetaField(row.original.metadata, "platformFeeCents")
					if (cents == null) return <span className="text-muted-foreground">-</span>
					return (
						<span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
							{formatCurrency(cents, row.original.currency)}
						</span>
					)
				},
			},
			{
				id: "stripeFee",
				header: "Stripe",
				cell: ({ row }) => {
					const cents = parseMetaField(row.original.metadata, "stripeFeeCents")
					if (cents == null) return <span className="text-muted-foreground">-</span>
					return (
						<span className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
							{formatCurrency(cents, row.original.currency)}
						</span>
					)
				},
			},
			{
				id: "organizerNet",
				header: "Payout",
				cell: ({ row }) => {
					const cents = parseMetaField(row.original.metadata, "organizerNetCents")
					if (cents == null) return <span className="text-muted-foreground">-</span>
					return (
						<span className="font-mono text-sm font-medium">
							{formatCurrency(cents, row.original.currency)}
						</span>
					)
				},
			},
			{
				accessorKey: "purchaseId",
				header: "Purchase ID",
				cell: ({ row }) => {
					const id = row.getValue("purchaseId") as string
					return <CopyButton value={id} />
				},
			},
			{
				accessorKey: "teamName",
				header: "Team",
				cell: ({ row }) => (
					<span className="text-sm">
						{row.getValue("teamName") ?? row.original.teamId}
					</span>
				),
			},
			{
				accessorKey: "reason",
				header: "Reason",
				cell: ({ row }) => {
					const reason = row.getValue("reason") as string | null
					if (!reason) return <span className="text-muted-foreground">-</span>
					return (
						<span className="text-sm max-w-48 truncate block" title={reason}>
							{reason}
						</span>
					)
				},
			},
			{
				id: "stripeRefs",
				header: "Stripe Refs",
				cell: ({ row }) => {
					const pi = row.original.stripePaymentIntentId
					const refund = row.original.stripeRefundId
					const dispute = row.original.stripeDisputeId
					const refs = [
						pi && { label: "PI", value: pi },
						refund && { label: "Ref", value: refund },
						dispute && { label: "Dis", value: dispute },
					].filter(Boolean) as { label: string; value: string }[]

					if (refs.length === 0)
						return <span className="text-muted-foreground">-</span>

					return (
						<div className="flex flex-col gap-0.5">
							{refs.map((ref) => (
								<div key={ref.value} className="flex items-center gap-1">
									<span className="text-[10px] font-medium text-muted-foreground uppercase">
										{ref.label}:
									</span>
									<CopyButton value={ref.value} />
								</div>
							))}
						</div>
					)
				},
			},
		],
		[],
	)

	const table = useReactTable({
		data: events,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	})

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				Loading events...
			</div>
		)
	}

	return (
		<div className="rounded-md border">
			<table className="w-full text-sm">
				<thead>
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id} className="border-b bg-muted/50">
							{headerGroup.headers.map((header) => (
								<th
									key={header.id}
									className="h-10 px-4 text-left font-medium text-muted-foreground"
								>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{table.getRowModel().rows.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length}
								className="h-24 text-center text-muted-foreground"
							>
								No financial events found.
							</td>
						</tr>
					) : (
						table.getRowModel().rows.map((row) => (
							<tr
								key={row.id}
								className="border-b transition-colors hover:bg-muted/50"
							>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-4 py-3">
										{flexRender(
											cell.column.columnDef.cell,
											cell.getContext(),
										)}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	)
}
