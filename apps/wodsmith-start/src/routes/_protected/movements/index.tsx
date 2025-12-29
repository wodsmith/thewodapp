import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronDown, Filter, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAllMovementsFn } from "@/server-fns/movement-fns"

export const Route = createFileRoute("/_protected/movements/")({
	component: MovementsPage,
	validateSearch: (search: Record<string, unknown>) => ({
		q: (search.q as string) || "",
		type: (search.type as string) || "",
	}),
	loader: async () => {
		const result = await getAllMovementsFn()
		return { movements: result.movements }
	},
})

function MovementsPage() {
	const { movements } = Route.useLoaderData()
	const navigate = useNavigate({ from: Route.fullPath })
	const { q, type } = Route.useSearch()
	const [searchTerm, setSearchTerm] = useState(q)
	const [isFilterOpen, setIsFilterOpen] = useState(false)

	// Get unique movement types
	const movementTypes = useMemo(() => {
		const types = new Set(movements.map((m) => m.type))
		return ["All", ...Array.from(types)]
	}, [movements])

	// Filter movements based on search and type
	const filteredMovements = useMemo(() => {
		return movements.filter((movement) => {
			const nameMatches = movement.name
				.toLowerCase()
				.includes(searchTerm.toLowerCase())
			const typeMatches = type && type !== "All" ? movement.type === type : true
			return nameMatches && typeMatches
		})
	}, [movements, searchTerm, type])

	// Handle search input change
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newQuery = e.target.value
		setSearchTerm(newQuery)
		navigate({
			search: (prev) => ({ ...prev, q: newQuery }),
		})
	}

	// Handle type filter change
	const handleTypeChange = (newType: string) => {
		setIsFilterOpen(false)
		navigate({
			search: (prev) => ({
				...prev,
				type: newType === "All" ? "" : newType,
			}),
		})
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-4xl font-bold">MOVEMENTS</h1>
				<Button asChild>
					<Link to="/movements/new">
						<Plus className="h-5 w-5 mr-2" />
						Create Movement
					</Link>
				</Button>
			</div>

			{/* Search + Filter */}
			<div className="mb-6 flex flex-col gap-4 sm:flex-row">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search movements..."
						className="pl-10"
						value={searchTerm}
						onChange={handleSearchChange}
					/>
				</div>
				<div className="relative">
					<Button
						variant="outline"
						className="w-full justify-between sm:w-auto min-w-[180px]"
						onClick={() => setIsFilterOpen(!isFilterOpen)}
					>
						<Filter className="h-4 w-4 mr-2" />
						<span>{type || "Filter by Type"}</span>
						<ChevronDown
							className={`ml-2 h-4 w-4 transition-transform ${
								isFilterOpen ? "rotate-180" : ""
							}`}
						/>
					</Button>
					{isFilterOpen && (
						<div className="absolute right-0 z-10 mt-1 w-full min-w-[180px] border border-border bg-background shadow-lg rounded-md overflow-hidden">
							{movementTypes.map((movementType) => (
								<Button
									key={movementType}
									variant="ghost"
									className="w-full justify-start rounded-none"
									onClick={() => handleTypeChange(movementType)}
								>
									{movementType}
								</Button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Empty state */}
			{filteredMovements.length === 0 && (searchTerm || type) && (
				<div className="text-center py-12">
					<p className="text-muted-foreground text-lg">
						No movements found for your criteria.
					</p>
				</div>
			)}

			{/* Movements Grid */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{filteredMovements.map((movement) => (
					<Link
						key={movement.id}
						to="/movements/$id"
						params={{ id: movement.id }}
						className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
					>
						<div className="flex items-center justify-between">
							<h3 className="font-semibold">{movement.name}</h3>
							<Badge variant="default" className="uppercase">
								{movement.type}
							</Badge>
						</div>
					</Link>
				))}
			</div>

			{/* Empty state when no movements exist */}
			{movements.length === 0 && (
				<div className="text-center py-12">
					<p className="text-muted-foreground text-lg">
						No movements yet. Create your first movement to get started.
					</p>
				</div>
			)}
		</div>
	)
}
