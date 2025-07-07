"use client"

import { Input } from "@/components/ui/input"
import { useQueryState } from "nuqs"

export function TrackSearchInput() {
	const [query, setQuery] = useQueryState("q", {
		history: "push",
		shallow: false,
		throttleMs: 300,
		defaultValue: "",
	})

	return (
		<div className="max-w-md">
			<Input
				placeholder="Search tracks..."
				value={query ?? ""}
				onChange={(e) => setQuery(e.target.value)}
			/>
		</div>
	)
}
