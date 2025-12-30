/**
 * Workout Filters Component
 * Provides advanced filtering options for workouts list
 * - Tags (multi-select)
 * - Movements (multi-select)
 * - Workout Type/Scheme (single select)
 * - Programming Track (single select)
 * - Type: All/Original/Remix (single select)
 */

import { ChevronDown, ChevronUp, Filter, X } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { WORKOUT_SCHEME_VALUES } from "@/db/schemas/workouts"
import { cn } from "@/utils/cn"

// Filter option types
export interface FilterOptions {
	tags: Array<{ id: string; name: string }>
	movements: Array<{ id: string; name: string; type: string }>
	tracks: Array<{ id: string; name: string }>
}

// Active filter values
export interface WorkoutFilters {
	tagIds: string[]
	movementIds: string[]
	workoutType?: (typeof WORKOUT_SCHEME_VALUES)[number]
	trackId?: string
	type?: "all" | "original" | "remix"
}

interface WorkoutFiltersProps {
	filterOptions: FilterOptions
	filters: WorkoutFilters
	onFiltersChange: (filters: WorkoutFilters) => void
	className?: string
}

// Human-readable labels for workout schemes
const SCHEME_LABELS: Record<string, string> = {
	time: "For Time",
	"time-with-cap": "For Time (Capped)",
	"pass-fail": "Pass/Fail",
	"rounds-reps": "AMRAP",
	reps: "Max Reps",
	emom: "EMOM",
	load: "Max Load",
	calories: "Max Calories",
	meters: "Max Distance (m)",
	feet: "Max Distance (ft)",
	points: "Points",
}

export function WorkoutFilters({
	filterOptions,
	filters,
	onFiltersChange,
	className,
}: WorkoutFiltersProps) {
	const [isOpen, setIsOpen] = useState(false)

	// Count active filters
	const activeFilterCount =
		filters.tagIds.length +
		filters.movementIds.length +
		(filters.workoutType ? 1 : 0) +
		(filters.trackId ? 1 : 0) +
		(filters.type && filters.type !== "all" ? 1 : 0)

	// Handle tag toggle
	const handleTagToggle = (tagId: string, checked: boolean) => {
		const newTagIds = checked
			? [...filters.tagIds, tagId]
			: filters.tagIds.filter((id) => id !== tagId)
		onFiltersChange({ ...filters, tagIds: newTagIds })
	}

	// Handle movement toggle
	const handleMovementToggle = (movementId: string, checked: boolean) => {
		const newMovementIds = checked
			? [...filters.movementIds, movementId]
			: filters.movementIds.filter((id) => id !== movementId)
		onFiltersChange({ ...filters, movementIds: newMovementIds })
	}

	// Handle workout type change
	const handleWorkoutTypeChange = (value: string) => {
		onFiltersChange({
			...filters,
			workoutType:
				value === "all"
					? undefined
					: (value as (typeof WORKOUT_SCHEME_VALUES)[number]),
		})
	}

	// Handle track change
	const handleTrackChange = (value: string) => {
		onFiltersChange({
			...filters,
			trackId: value === "all" ? undefined : value,
		})
	}

	// Handle type filter change
	const handleTypeChange = (value: string) => {
		onFiltersChange({
			...filters,
			type: value as "all" | "original" | "remix",
		})
	}

	// Clear all filters
	const clearAllFilters = () => {
		onFiltersChange({
			tagIds: [],
			movementIds: [],
			workoutType: undefined,
			trackId: undefined,
			type: "all",
		})
	}

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className={cn("w-full", className)}
		>
			<div className="flex items-center justify-between">
				<CollapsibleTrigger asChild>
					<Button variant="outline" size="sm" className="gap-2">
						<Filter className="h-4 w-4" />
						Filters
						{activeFilterCount > 0 && (
							<Badge variant="secondary" className="ml-1">
								{activeFilterCount}
							</Badge>
						)}
						{isOpen ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</Button>
				</CollapsibleTrigger>

				{activeFilterCount > 0 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={clearAllFilters}
						className="text-muted-foreground"
					>
						<X className="h-4 w-4 mr-1" />
						Clear all
					</Button>
				)}
			</div>

			<CollapsibleContent className="mt-4">
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 p-4 border rounded-lg bg-muted/30">
					{/* Type Filter: All/Original/Remix */}
					<div className="space-y-2">
						<Label className="text-sm font-medium">Workout Source</Label>
						<Select
							value={filters.type || "all"}
							onValueChange={handleTypeChange}
						>
							<SelectTrigger>
								<SelectValue placeholder="All workouts" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All workouts</SelectItem>
								<SelectItem value="original">Original only</SelectItem>
								<SelectItem value="remix">Remixes only</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Workout Scheme Filter */}
					<div className="space-y-2">
						<Label className="text-sm font-medium">Workout Type</Label>
						<Select
							value={filters.workoutType || "all"}
							onValueChange={handleWorkoutTypeChange}
						>
							<SelectTrigger>
								<SelectValue placeholder="All types" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All types</SelectItem>
								{WORKOUT_SCHEME_VALUES.map((scheme) => (
									<SelectItem key={scheme} value={scheme}>
										{SCHEME_LABELS[scheme] || scheme}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Track Filter */}
					{filterOptions.tracks.length > 0 && (
						<div className="space-y-2">
							<Label className="text-sm font-medium">Programming Track</Label>
							<Select
								value={filters.trackId || "all"}
								onValueChange={handleTrackChange}
							>
								<SelectTrigger>
									<SelectValue placeholder="All tracks" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All tracks</SelectItem>
									{filterOptions.tracks.map((track) => (
										<SelectItem key={track.id} value={track.id}>
											{track.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Tags Filter */}
					{filterOptions.tags.length > 0 && (
						<div className="space-y-2 md:col-span-2 lg:col-span-3">
							<Label className="text-sm font-medium">Tags</Label>
							<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded bg-background">
								{filterOptions.tags.map((tag) => (
									<label
										key={tag.id}
										className="flex items-center gap-2 cursor-pointer"
									>
										<Checkbox
											checked={filters.tagIds.includes(tag.id)}
											onCheckedChange={(checked) =>
												handleTagToggle(tag.id, checked === true)
											}
										/>
										<span className="text-sm">{tag.name}</span>
									</label>
								))}
							</div>
						</div>
					)}

					{/* Movements Filter */}
					{filterOptions.movements.length > 0 && (
						<div className="space-y-2 md:col-span-2 lg:col-span-3">
							<Label className="text-sm font-medium">Movements</Label>
							<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded bg-background">
								{filterOptions.movements.map((movement) => (
									<label
										key={movement.id}
										className="flex items-center gap-2 cursor-pointer"
									>
										<Checkbox
											checked={filters.movementIds.includes(movement.id)}
											onCheckedChange={(checked) =>
												handleMovementToggle(movement.id, checked === true)
											}
										/>
										<span className="text-sm">{movement.name}</span>
									</label>
								))}
							</div>
						</div>
					)}
				</div>
			</CollapsibleContent>

			{/* Active filters display (when collapsed) */}
			{!isOpen && activeFilterCount > 0 && (
				<div className="flex flex-wrap gap-2 mt-2">
					{filters.type && filters.type !== "all" && (
						<Badge variant="secondary" className="gap-1">
							{filters.type === "original" ? "Original" : "Remix"}
							<X
								className="h-3 w-3 cursor-pointer"
								onClick={() => onFiltersChange({ ...filters, type: "all" })}
							/>
						</Badge>
					)}
					{filters.workoutType && (
						<Badge variant="secondary" className="gap-1">
							{SCHEME_LABELS[filters.workoutType] || filters.workoutType}
							<X
								className="h-3 w-3 cursor-pointer"
								onClick={() =>
									onFiltersChange({ ...filters, workoutType: undefined })
								}
							/>
						</Badge>
					)}
					{filters.trackId && (
						<Badge variant="secondary" className="gap-1">
							{filterOptions.tracks.find((t) => t.id === filters.trackId)
								?.name || "Track"}
							<X
								className="h-3 w-3 cursor-pointer"
								onClick={() =>
									onFiltersChange({ ...filters, trackId: undefined })
								}
							/>
						</Badge>
					)}
					{filters.tagIds.map((tagId) => {
						const tag = filterOptions.tags.find((t) => t.id === tagId)
						return (
							<Badge key={tagId} variant="secondary" className="gap-1">
								{tag?.name || tagId}
								<X
									className="h-3 w-3 cursor-pointer"
									onClick={() => handleTagToggle(tagId, false)}
								/>
							</Badge>
						)
					})}
					{filters.movementIds.map((movementId) => {
						const movement = filterOptions.movements.find(
							(m) => m.id === movementId,
						)
						return (
							<Badge key={movementId} variant="secondary" className="gap-1">
								{movement?.name || movementId}
								<X
									className="h-3 w-3 cursor-pointer"
									onClick={() => handleMovementToggle(movementId, false)}
								/>
							</Badge>
						)
					})}
				</div>
			)}
		</Collapsible>
	)
}
