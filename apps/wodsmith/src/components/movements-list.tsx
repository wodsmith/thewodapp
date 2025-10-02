"use client"

import { useState, useMemo } from "react"
import { Search, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import type { Movement } from "@/db/schema"
import { MOVEMENT_TYPE_VALUES } from "@/db/schemas/workouts"

// Flexible movement type that can accept partial Movement data
type MovementData = Pick<Movement, "id" | "name" | "type">

interface MovementsListProps {
	movements: MovementData[]
	selectedMovements?: string[]
	onMovementToggle?: (movementId: string) => void
	mode?: "selectable" | "display"
	variant?: "default" | "compact" | "badge"
	className?: string
	showLabel?: boolean
	containerHeight?: string
	enableCreateMovement?: boolean
	onCreateMovement?: (name: string, type: string) => void
}

export function MovementsList({
	movements,
	selectedMovements = [],
	onMovementToggle,
	mode = "selectable",
	variant = "default",
	className = "",
	showLabel = true,
	containerHeight = "h-[500px]",
	enableCreateMovement = false,
	onCreateMovement,
}: MovementsListProps) {
	const [searchQuery, setSearchQuery] = useState("")
	const [typeFilter, setTypeFilter] = useState<string>("all")
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [newMovementName, setNewMovementName] = useState("")
	const [newMovementType, setNewMovementType] = useState<string>("")

	const filteredMovements = useMemo(() => {
		return movements.filter((movement) => {
			const matchesSearch = movement.name
				.toLowerCase()
				.includes(searchQuery.toLowerCase())
			const matchesType = typeFilter === "all" || movement.type === typeFilter
			return matchesSearch && matchesType
		})
	}, [movements, searchQuery, typeFilter])

	const clearFilters = () => {
		setSearchQuery("")
		setTypeFilter("all")
	}

	const hasActiveFilters = searchQuery || typeFilter !== "all"

	// Show create button if search query doesn't match any existing movements
	const _showCreateButton =
		enableCreateMovement &&
		searchQuery &&
		!filteredMovements.some(
			(movement) => movement.name.toLowerCase() === searchQuery.toLowerCase(),
		)

	const handleCreateMovement = () => {
		if (newMovementName && newMovementType && onCreateMovement) {
			onCreateMovement(newMovementName, newMovementType)
			setIsCreateDialogOpen(false)
			setNewMovementName("")
			setNewMovementType("")
			if (searchQuery) {
				setSearchQuery("")
			}
		}
	}

	const openCreateDialog = () => {
		setNewMovementName(searchQuery || "")
		setNewMovementType("")
		setIsCreateDialogOpen(true)
	}

	if (mode === "display" && variant === "badge") {
		return (
			<div className={`flex flex-wrap gap-2 ${className}`}>
				{movements.map((movement) => (
					<Badge key={movement.id} variant="outline" className="text-lg">
						{movement.name}
					</Badge>
				))}
			</div>
		)
	}

	return (
		<div className={className}>
			{showLabel && (
				<Label
					htmlFor="movements-list"
					className="mb-2 block font-bold uppercase"
				>
					Movements
				</Label>
			)}

			{/* Search and Filter Controls */}
			<div className="mb-4 space-y-2">
				<div className="flex flex-col sm:flex-row gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search movements..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="sm:w-[180px]">
							<SelectValue placeholder="Filter by type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							{MOVEMENT_TYPE_VALUES.map((type) => (
								<SelectItem key={type} value={type}>
									{type.charAt(0).toUpperCase() + type.slice(1)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{hasActiveFilters && (
						<Button
							variant="outline"
							size="icon"
							onClick={clearFilters}
							title="Clear filters"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
				{hasActiveFilters && (
					<div className="text-sm text-muted-foreground">
						Showing {filteredMovements.length} of {movements.length} movements
					</div>
				)}
			</div>

			{/* Movements List */}
			<div
				id="movements-list"
				className={`${containerHeight} overflow-y-auto border-2 border-black sm:p-4`}
			>
				<div className="space-y-2">
					{filteredMovements.length === 0 ? (
						<div className="flex h-32 items-center justify-center text-muted-foreground">
							No movements found
						</div>
					) : (
						filteredMovements.map((movement) => {
							const isSelected = selectedMovements.includes(movement.id)

							if (variant === "compact") {
								return (
									<Button
										key={movement.id}
										type="button"
										variant={isSelected ? "default" : "outline"}
										className="w-full justify-between"
										onClick={() => onMovementToggle?.(movement.id)}
									>
										<span className="font-bold">{movement.name}</span>
										<span className="text-xs uppercase">{movement.type}</span>
									</Button>
								)
							}

							// Default variant - custom button styling
							return (
								<button
									key={movement.id}
									type="button"
									onClick={() => onMovementToggle?.(movement.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault()
											onMovementToggle?.(movement.id)
										}
									}}
									aria-pressed={isSelected}
									className={`flex w-full cursor-pointer items-center justify-between border-2 border-black px-2 py-1 ${
										isSelected ? "bg-black text-white" : ""
									}`}
								>
									<span className="font-bold">{movement.name}</span>
									<div className="flex items-center gap-2">
										<span className="text-xs uppercase">{movement.type}</span>
										{isSelected && <span className="text-xs">✓</span>}
									</div>
								</button>
							)
						})
					)}

					{/* Create Movement Button */}
					{enableCreateMovement && (
						<Dialog
							open={isCreateDialogOpen}
							onOpenChange={setIsCreateDialogOpen}
						>
							<DialogTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className="w-full mt-2 border-dashed"
									onClick={openCreateDialog}
								>
									<Plus className="h-4 w-4 mr-2" />
									{searchQuery
										? `Create "${searchQuery}"`
										: "Create new movement"}
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create New Movement</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<div>
										<Label htmlFor="movement-name">Movement Name</Label>
										<Input
											id="movement-name"
											value={newMovementName}
											onChange={(e) => setNewMovementName(e.target.value)}
											placeholder="Enter movement name"
										/>
									</div>
									<div>
										<Label htmlFor="movement-type">Movement Type</Label>
										<Select
											value={newMovementType}
											onValueChange={setNewMovementType}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select movement type" />
											</SelectTrigger>
											<SelectContent>
												{MOVEMENT_TYPE_VALUES.map((type) => (
													<SelectItem key={type} value={type}>
														{type.charAt(0).toUpperCase() + type.slice(1)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="flex gap-2 justify-end">
										<Button
											variant="outline"
											onClick={() => setIsCreateDialogOpen(false)}
										>
											Cancel
										</Button>
										<Button
											onClick={handleCreateMovement}
											disabled={!newMovementName || !newMovementType}
										>
											Create Movement
										</Button>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					)}
				</div>
			</div>
		</div>
	)
}
