"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
	value: string
	label: string
	/** Optional description shown below the label */
	description?: string
}

interface SearchableSelectProps {
	options: SearchableSelectOption[]
	value?: string
	onValueChange: (value: string) => void
	placeholder?: string
	searchPlaceholder?: string
	emptyMessage?: string
	className?: string
	disabled?: boolean
}

export function SearchableSelect({
	options,
	value,
	onValueChange,
	placeholder = "Select...",
	searchPlaceholder = "Search...",
	emptyMessage = "No results found.",
	className,
	disabled,
}: SearchableSelectProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")
	const [highlightedIndex, setHighlightedIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	const filteredOptions = options.filter((option) =>
		option.label.toLowerCase().includes(search.toLowerCase()),
	)

	const selectedOption = options.find((option) => option.value === value)

	const selectOption = useCallback(
		(optionValue: string) => {
			onValueChange(optionValue)
			setOpen(false)
			setSearch("")
			setHighlightedIndex(0)
		},
		[onValueChange],
	)

	// Focus input when popover opens
	useEffect(() => {
		if (open) {
			// Use requestAnimationFrame to ensure the portal has rendered
			const id = requestAnimationFrame(() => {
				inputRef.current?.focus()
			})
			return () => cancelAnimationFrame(id)
		}
	}, [open])

	// Scroll highlighted option into view
	useEffect(() => {
		if (!listRef.current) return
		const items = listRef.current.querySelectorAll("[role='option']")
		const item = items[highlightedIndex]
		if (item) {
			item.scrollIntoView({ block: "nearest" })
		}
	}, [highlightedIndex])

	return (
		<Popover
			open={open}
			onOpenChange={(isOpen) => {
				setOpen(isOpen)
				if (!isOpen) {
					setSearch("")
					setHighlightedIndex(0)
				}
			}}
		>
			<PopoverTrigger asChild>
				{/* biome-ignore lint/a11y/useSemanticElements: Custom combobox requires non-semantic elements */}
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					tabIndex={0}
					className={cn("w-full justify-between font-normal", className)}
					disabled={disabled}
				>
					<span className="truncate">
						{selectedOption ? selectedOption.label : placeholder}
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[var(--radix-popover-trigger-width)] p-0"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				<div className="p-2">
					{/* Using native input to avoid any component-level event interception */}
					<input
						ref={inputRef}
						placeholder={searchPlaceholder}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value)
							setHighlightedIndex(0)
						}}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault()
								e.stopPropagation()
								if (filteredOptions.length === 0) return
								setHighlightedIndex((prev) =>
									prev < filteredOptions.length - 1 ? prev + 1 : 0,
								)
							} else if (e.key === "ArrowUp") {
								e.preventDefault()
								e.stopPropagation()
								if (filteredOptions.length === 0) return
								setHighlightedIndex((prev) =>
									prev > 0 ? prev - 1 : filteredOptions.length - 1,
								)
							} else if (e.key === "Enter") {
								e.preventDefault()
								e.stopPropagation()
								const option = filteredOptions[highlightedIndex]
								if (option) {
									selectOption(option.value)
								}
							} else if (e.key === "Escape") {
								e.preventDefault()
								setOpen(false)
								setSearch("")
								setHighlightedIndex(0)
							}
						}}
						className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
				</div>
				<ScrollArea className="h-[200px]">
					{filteredOptions.length === 0 ? (
						<p className="p-2 text-sm text-muted-foreground text-center">
							{emptyMessage}
						</p>
					) : (
						<div className="p-1" role="listbox" ref={listRef}>
							{filteredOptions.map((option, index) => (
								<button
									key={option.value}
									type="button"
									role="option"
									tabIndex={-1}
									aria-selected={value === option.value}
									onClick={() => selectOption(option.value)}
									onMouseEnter={() => setHighlightedIndex(index)}
									className={cn(
										"flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
										value === option.value && "bg-accent",
										index === highlightedIndex &&
											"bg-accent text-accent-foreground",
									)}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4 shrink-0",
											value === option.value ? "opacity-100" : "opacity-0",
										)}
									/>
									<div className="flex flex-col items-start">
										<span>{option.label}</span>
										{option.description && (
											<span className="text-xs text-muted-foreground">
												{option.description}
											</span>
										)}
									</div>
								</button>
							))}
						</div>
					)}
				</ScrollArea>
			</PopoverContent>
		</Popover>
	)
}
