"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { FormattedSetData } from "@/server-fns/workout-sets-fns"

/**
 * Props for MultiRoundSets component
 */
interface MultiRoundSetsProps {
	/** Array of formatted set data to display */
	sets: FormattedSetData[]
	/** Optional title for the sets section */
	title?: string
	/** Number of sets to show before collapsing (default: 5) */
	collapseAfter?: number
	/** Whether to show the round number column (default: true) */
	showRoundNumber?: boolean
	/** Display variant: 'table' or 'list' (default: 'table') */
	variant?: "table" | "list"
	/** Optional class name for the container */
	className?: string
	/** Whether the sets are loading */
	isLoading?: boolean
}

/**
 * Component to display multi-round workout sets
 * (e.g., '10x3 Back Squat' showing weight for each set)
 *
 * Supports:
 * - Table or list view
 * - Collapsible for long lists
 * - Different score formats (weight x reps, time, rounds+reps, etc.)
 *
 * @example
 * <MultiRoundSets
 *   sets={[
 *     { roundNumber: 1, value: 102058, displayValue: "225 lbs", notes: null, status: null },
 *     { roundNumber: 2, value: 102058, displayValue: "225 lbs", notes: null, status: null },
 *   ]}
 *   title="Back Squat Sets"
 *   collapseAfter={5}
 * />
 */
export function MultiRoundSets({
	sets,
	title,
	collapseAfter = 5,
	showRoundNumber = true,
	variant = "table",
	className = "",
	isLoading = false,
}: MultiRoundSetsProps) {
	const [isOpen, setIsOpen] = useState(false)

	// Handle loading state
	if (isLoading) {
		return (
			<div className={`animate-pulse ${className}`}>
				<div className="h-4 bg-muted rounded w-24 mb-2" />
				<div className="space-y-2">
					<div className="h-8 bg-muted rounded" />
					<div className="h-8 bg-muted rounded" />
					<div className="h-8 bg-muted rounded" />
				</div>
			</div>
		)
	}

	// Handle empty state
	if (sets.length === 0) {
		return (
			<div className={`text-muted-foreground text-sm ${className}`}>
				No sets recorded
			</div>
		)
	}

	const needsCollapsible = sets.length > collapseAfter
	const visibleSets =
		needsCollapsible && !isOpen ? sets.slice(0, collapseAfter) : sets
	const hiddenCount = sets.length - collapseAfter

	const content =
		variant === "table"
			? renderTable(visibleSets, showRoundNumber)
			: renderList(visibleSets, showRoundNumber)

	return (
		<div className={className}>
			{title && <h4 className="text-sm font-medium mb-2">{title}</h4>}

			{needsCollapsible ? (
				<Collapsible open={isOpen} onOpenChange={setIsOpen}>
					{content}
					<CollapsibleContent>
						{isOpen &&
							(variant === "table"
								? renderTableRows(sets.slice(collapseAfter), showRoundNumber)
								: renderListItems(sets.slice(collapseAfter), showRoundNumber))}
					</CollapsibleContent>
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="w-full mt-2 text-muted-foreground hover:text-foreground"
						>
							{isOpen ? (
								<>
									<ChevronUp className="h-4 w-4 mr-1" />
									Show less
								</>
							) : (
								<>
									<ChevronDown className="h-4 w-4 mr-1" />
									Show {hiddenCount} more set{hiddenCount !== 1 ? "s" : ""}
								</>
							)}
						</Button>
					</CollapsibleTrigger>
				</Collapsible>
			) : (
				content
			)}
		</div>
	)
}

/**
 * Render sets in table format
 */
function renderTable(sets: FormattedSetData[], showRoundNumber: boolean) {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						{showRoundNumber && <TableHead className="w-16">Set</TableHead>}
						<TableHead>Score</TableHead>
						<TableHead className="w-24 text-right">Notes</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>{renderTableRows(sets, showRoundNumber)}</TableBody>
			</Table>
		</div>
	)
}

/**
 * Render table rows for sets
 */
function renderTableRows(sets: FormattedSetData[], showRoundNumber: boolean) {
	return sets.map((set) => (
		<TableRow key={set.roundNumber}>
			{showRoundNumber && (
				<TableCell className="font-medium text-muted-foreground">
					{set.roundNumber}
				</TableCell>
			)}
			<TableCell className="font-mono">{formatSetValue(set)}</TableCell>
			<TableCell className="text-right text-muted-foreground text-sm">
				{set.notes || "-"}
			</TableCell>
		</TableRow>
	))
}

/**
 * Render sets in list format (more compact)
 */
function renderList(sets: FormattedSetData[], showRoundNumber: boolean) {
	return (
		<div className="space-y-1">{renderListItems(sets, showRoundNumber)}</div>
	)
}

/**
 * Render list items for sets
 */
function renderListItems(sets: FormattedSetData[], showRoundNumber: boolean) {
	return sets.map((set) => (
		<div
			key={set.roundNumber}
			className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50"
		>
			<div className="flex items-center gap-2">
				{showRoundNumber && (
					<span className="text-muted-foreground text-sm w-8">
						#{set.roundNumber}
					</span>
				)}
				<span className="font-mono">{formatSetValue(set)}</span>
			</div>
			{set.notes && (
				<span className="text-muted-foreground text-xs truncate max-w-[120px]">
					{set.notes}
				</span>
			)}
		</div>
	))
}

/**
 * Format the display value for a set, handling special statuses
 */
function formatSetValue(set: FormattedSetData): string {
	if (set.status === "cap") {
		return `CAP${set.displayValue ? ` (${set.displayValue})` : ""}`
	}
	if (set.status === "dq") {
		return "DQ"
	}
	if (set.status === "withdrawn") {
		return "WD"
	}
	return set.displayValue
}

/**
 * Compact variant for inline display
 * Shows sets as comma-separated values
 */
interface MultiRoundSetsInlineProps {
	/** Array of formatted set data to display */
	sets: FormattedSetData[]
	/** Maximum number of sets to show before truncating */
	maxDisplay?: number
	/** Optional class name */
	className?: string
}

export function MultiRoundSetsInline({
	sets,
	maxDisplay = 5,
	className = "",
}: MultiRoundSetsInlineProps) {
	if (sets.length === 0) {
		return <span className={`text-muted-foreground ${className}`}>-</span>
	}

	const displaySets = sets.slice(0, maxDisplay)
	const remainingCount = sets.length - maxDisplay

	return (
		<span className={`font-mono text-sm ${className}`}>
			{displaySets.map((set) => formatSetValue(set)).join(", ")}
			{remainingCount > 0 && (
				<span className="text-muted-foreground ml-1">
					+{remainingCount} more
				</span>
			)}
		</span>
	)
}

/**
 * Summary component showing aggregate stats for sets
 */
interface MultiRoundSetsSummaryProps {
	/** Array of formatted set data */
	sets: FormattedSetData[]
	/** Label for the summary (e.g., "Sets", "Rounds") */
	label?: string
	/** Optional class name */
	className?: string
}

export function MultiRoundSetsSummary({
	sets,
	label = "sets",
	className = "",
}: MultiRoundSetsSummaryProps) {
	if (sets.length === 0) {
		return null
	}

	return (
		<div className={`text-sm text-muted-foreground ${className}`}>
			{sets.length} {label}
		</div>
	)
}
