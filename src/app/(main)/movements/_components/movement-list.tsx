"use client"

import { ChevronDown, Filter, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Movement } from "@/types"

interface MovementListProps {
	movements: Movement[]
}

export default function MovementList({ movements }: MovementListProps) {
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedType, setSelectedType] = useState<string | null>(null)
	const [isFilterOpen, setIsFilterOpen] = useState(false)

	const movementTypes = useMemo(() => {
		const types = new Set(movements.map((m) => m.type))
		return ["All", ...Array.from(types)]
	}, [movements])

	const filteredMovements = useMemo(() => {
		return movements.filter((movement) => {
			const nameMatches = movement.name
				.toLowerCase()
				.includes(searchTerm.toLowerCase())
			const typeMatches =
				selectedType && selectedType !== "All"
					? movement.type === selectedType
					: true
			return nameMatches && typeMatches
		})
	}, [movements, searchTerm, selectedType])

	return (
		<div>
			<div className="mb-6 flex flex-col gap-4 sm:flex-row">
				<div className="relative flex-1">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 transform text-gray-500" />
					<Input
						type="text"
						placeholder="Search movements..."
						className="pl-10"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<div className="relative">
					<Button
						variant="outline"
						className="w-full justify-between sm:w-auto"
						onClick={() => setIsFilterOpen(!isFilterOpen)}
					>
						<Filter className="h-5 w-5" />
						<span>{selectedType || "Filter by Type"}</span>
						<ChevronDown
							className={`h-5 w-5 transition-transform ${
								isFilterOpen ? "rotate-180" : ""
							}`}
						/>
					</Button>
					{isFilterOpen && (
						<div className="absolute right-0 z-10 mt-1 w-full min-w-[150px]   border border-gray-200 bg-white shadow-lg sm:right-auto sm:w-auto">
							{movementTypes.map((type) => (
								<Button
									key={type}
									variant="ghost"
									className="w-full justify-start"
									onClick={() => {
										setSelectedType(type === "All" ? null : type)
										setIsFilterOpen(false)
									}}
								>
									{type}
								</Button>
							))}
						</div>
					)}
				</div>
			</div>

			{filteredMovements.length === 0 && (searchTerm || selectedType) && (
				<p className="text-center text-gray-500">
					No movements found for your criteria.
				</p>
			)}

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{filteredMovements.map((movement) => (
					<Link
						key={movement.id}
						href={`/movements/${movement.id}`}
						className="card transition-colors hover:bg-gray-50 dark:hover:text-black"
					>
						<div className="flex items-center justify-between">
							<h3 className="mb-2">{movement.name}</h3>
							<span className="bg-black px-2 py-1 font-bold text-white text-xs uppercase">
								{movement.type}
							</span>
						</div>
					</Link>
				))}
			</div>
		</div>
	)
}
