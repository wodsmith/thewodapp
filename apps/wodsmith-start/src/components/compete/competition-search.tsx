"use client"

import { useState } from "react"
import { Input } from "~/components/ui/input"

interface CompetitionSearchProps {
	onSearch?: (query: string) => void
	placeholder?: string
}

export function CompetitionSearch({
	onSearch,
	placeholder = "Search competitions...",
}: CompetitionSearchProps) {
	const [query, setQuery] = useState("")

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		setQuery(value)
		onSearch?.(value)
	}

	return (
		<div className="relative">
			<Input
				type="search"
				placeholder={placeholder}
				value={query}
				onChange={handleChange}
				className="w-full"
			/>
		</div>
	)
}
