"use client"

import { Search, X } from "lucide-react"
import { parseAsBoolean, useQueryState } from "nuqs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CompetitionSearch() {
	const [search, setSearch] = useQueryState("q", {
		defaultValue: "",
		shallow: false,
	})
	const [showPast, setShowPast] = useQueryState("past", {
		...parseAsBoolean,
		defaultValue: false,
		shallow: false,
	})

	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
			<div className="relative flex-1">
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
			<div className="flex items-center gap-2">
				<Checkbox
					id="show-past"
					checked={showPast}
					onCheckedChange={(checked) => setShowPast(checked === true || null)}
				/>
				<Label
					htmlFor="show-past"
					className="text-sm text-muted-foreground cursor-pointer"
				>
					Show past competitions
				</Label>
			</div>
		</div>
	)
}
