"use client"

import { Search, X } from "lucide-react"
import { useQueryState } from "nuqs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CompetitionSearch() {
	const [search, setSearch] = useQueryState("q", {
		defaultValue: "",
		shallow: false,
	})

	return (
		<div className="relative">
			<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="text"
				placeholder="Search competitions..."
				value={search}
				onChange={(e) => setSearch(e.target.value || null)}
				className="pl-10 pr-10"
			/>
			{search && (
				<Button
					variant="ghost"
					size="icon"
					className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
					onClick={() => setSearch(null)}
				>
					<X className="h-4 w-4" />
				</Button>
			)}
		</div>
	)
}
