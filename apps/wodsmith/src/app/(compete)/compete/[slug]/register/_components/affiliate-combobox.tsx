"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
	Check,
	ChevronsUpDown,
	Search,
	Building2,
	ShieldCheck,
	ShieldQuestion,
} from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { searchAffiliatesAction } from "@/actions/affiliate-actions"

type Affiliate = {
	id: string
	name: string
	verificationStatus: "unverified" | "verified" | "claimed"
	location: string | null
}

type Props = {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	disabled?: boolean
}

function VerificationBadge({
	status,
}: {
	status: Affiliate["verificationStatus"]
}) {
	switch (status) {
		case "verified":
			return (
				<Badge variant="default" className="ml-2 text-xs bg-green-600">
					<ShieldCheck className="w-3 h-3 mr-1" />
					Verified
				</Badge>
			)
		case "claimed":
			return (
				<Badge variant="default" className="ml-2 text-xs bg-blue-600">
					<Building2 className="w-3 h-3 mr-1" />
					Claimed
				</Badge>
			)
		default:
			return (
				<Badge variant="outline" className="ml-2 text-xs">
					<ShieldQuestion className="w-3 h-3 mr-1" />
					Unverified
				</Badge>
			)
	}
}

export function AffiliateCombobox({
	value,
	onChange,
	placeholder = "Search or enter affiliate...",
	disabled = false,
}: Props) {
	const [open, setOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [affiliates, setAffiliates] = useState<Affiliate[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const debounceRef = useRef<NodeJS.Timeout | null>(null)

	const { execute: searchAffiliates } = useServerAction(
		searchAffiliatesAction,
		{
			onSuccess: (result) => {
				setAffiliates(result.data as Affiliate[])
				setIsLoading(false)
			},
			onError: () => {
				setIsLoading(false)
			},
		},
	)

	// Load initial affiliates when dropdown opens
	useEffect(() => {
		if (open && affiliates.length === 0) {
			setIsLoading(true)
			searchAffiliates({ query: "" })
		}
	}, [open, affiliates.length, searchAffiliates])

	// Debounced search
	const handleSearch = useCallback(
		(query: string) => {
			setSearchQuery(query)

			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}

			debounceRef.current = setTimeout(() => {
				setIsLoading(true)
				searchAffiliates({ query })
			}, 300)
		},
		[searchAffiliates],
	)

	const handleSelect = (affiliateName: string) => {
		onChange(affiliateName)
		setOpen(false)
		setSearchQuery("")
	}

	const handleUseCustom = () => {
		if (searchQuery.trim()) {
			onChange(searchQuery.trim())
			setOpen(false)
			setSearchQuery("")
		}
	}

	// Check if current search query matches any affiliate
	const exactMatch = affiliates.find(
		(a) => a.name.toLowerCase() === searchQuery.toLowerCase(),
	)
	const showAddNew = searchQuery.trim().length > 0 && !exactMatch

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				{/* biome-ignore lint/a11y/useSemanticElements: Shadcn combobox pattern requires role="combobox" */}
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between font-normal"
					disabled={disabled}
				>
					{value || placeholder}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] p-0"
				align="start"
			>
				<div className="flex items-center border-b px-3 py-2">
					<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
					<Input
						placeholder="Search affiliates..."
						value={searchQuery}
						onChange={(e) => handleSearch(e.target.value)}
						className="h-8 border-0 p-0 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
					/>
				</div>
				<div className="max-h-[300px] overflow-y-auto">
					{isLoading ? (
						<div className="py-6 text-center text-sm text-muted-foreground">
							Loading...
						</div>
					) : affiliates.length === 0 && !searchQuery ? (
						<div className="py-6 text-center text-sm text-muted-foreground">
							No affiliates found. Type to add a new one.
						</div>
					) : (
						<div className="p-1">
							{/* Option to add custom affiliate */}
							{showAddNew && (
								<button
									type="button"
									onClick={handleUseCustom}
									className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground border-b mb-1"
								>
									<span className="flex-1 text-left">
										Add "<span className="font-medium">{searchQuery}</span>"
									</span>
									<Badge variant="secondary" className="text-xs">
										New
									</Badge>
								</button>
							)}

							{/* Existing affiliates */}
							{affiliates.map((affiliate) => (
								<button
									key={affiliate.id}
									type="button"
									onClick={() => handleSelect(affiliate.name)}
									className={cn(
										"relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
										value === affiliate.name && "bg-accent",
									)}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											value === affiliate.name ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="flex-1 text-left truncate">
										{affiliate.name}
										{affiliate.location && (
											<span className="text-muted-foreground ml-1">
												({affiliate.location})
											</span>
										)}
									</span>
									<VerificationBadge status={affiliate.verificationStatus} />
								</button>
							))}

							{affiliates.length === 0 && searchQuery && !showAddNew && (
								<div className="py-6 text-center text-sm text-muted-foreground">
									No matching affiliates found.
								</div>
							)}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
