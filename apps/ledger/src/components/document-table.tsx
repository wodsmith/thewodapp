import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import {
	ArrowUpDown,
	Download,
	Search,
	Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { Document } from "@/db/schema"
import { cn } from "@/utils/cn"

function formatCurrency(cents: number | null, currency: string): string {
	if (cents === null) return "-"
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100)
}

function formatDate(dateStr: string | null): string {
	if (!dateStr) return "-"
	return new Date(dateStr).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

const statusColors: Record<string, string> = {
	paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	unpaid:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

interface DocumentTableProps {
	documents: Document[]
	onDelete: (id: string) => void
	onDownload: (id: string) => void
	deletingId: string | null
}

export function DocumentTable({
	documents,
	onDelete,
	onDownload,
	deletingId,
}: DocumentTableProps) {
	const [sorting, setSorting] = useState<SortingState>([])
	const [globalFilter, setGlobalFilter] = useState("")

	const columns = useMemo<ColumnDef<Document>[]>(
		() => [
			{
				accessorKey: "vendor",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
					>
						Vendor
						<ArrowUpDown className="h-3.5 w-3.5" />
					</button>
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.getValue("vendor")}</span>
				),
			},
			{
				accessorKey: "fileName",
				header: "File",
				cell: ({ row }) => (
					<span className="max-w-48 truncate text-sm text-muted-foreground">
						{row.getValue("fileName")}
					</span>
				),
			},
			{
				accessorKey: "category",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
					>
						Category
						<ArrowUpDown className="h-3.5 w-3.5" />
					</button>
				),
				cell: ({ row }) => {
					const category = row.getValue("category") as string | null
					return (
						<span className="capitalize text-sm">
							{category || "-"}
						</span>
					)
				},
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
				cell: ({ row }) =>
					formatCurrency(
						row.getValue("amountCents"),
						row.original.currency,
					),
			},
			{
				accessorKey: "subscriptionTerm",
				header: "Term",
				cell: ({ row }) => {
					const term = row.getValue("subscriptionTerm") as string | null
					return (
						<span className="capitalize text-sm">{term || "-"}</span>
					)
				},
			},
			{
				accessorKey: "invoiceDate",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
					>
						Invoice Date
						<ArrowUpDown className="h-3.5 w-3.5" />
					</button>
				),
				cell: ({ row }) =>
					formatDate(row.getValue("invoiceDate")),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => {
					const status = row.getValue("status") as string
					return (
						<span
							className={cn(
								"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
								statusColors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
							)}
						>
							{status}
						</span>
					)
				},
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="flex items-center gap-1 justify-end">
						<button
							type="button"
							onClick={() => onDownload(row.original.id)}
							className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
							title="Download"
						>
							<Download className="h-4 w-4" />
						</button>
						<button
							type="button"
							onClick={() => onDelete(row.original.id)}
							disabled={deletingId === row.original.id}
							className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-destructive/10 text-destructive disabled:opacity-50"
							title="Delete"
						>
							<Trash2 className="h-4 w-4" />
						</button>
					</div>
				),
			},
		],
		[onDelete, onDownload, deletingId],
	)

	const table = useReactTable({
		data: documents,
		columns,
		state: { sorting, globalFilter },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	})

	return (
		<div className="space-y-4">
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search documents..."
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				/>
			</div>

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
									No documents found. Upload your first invoice.
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

			<div className="text-xs text-muted-foreground">
				{documents.length} document{documents.length !== 1 ? "s" : ""}
			</div>
		</div>
	)
}
