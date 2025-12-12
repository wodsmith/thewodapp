"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, Search } from "lucide-react"
import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
	value?: string
	onValueChange: (value: string) => void
	options: string[] | { value: string; label: string }[]
	placeholder?: string
	className?: string
	searchPlaceholder?: string
}

export function SearchableSelect({
	value,
	onValueChange,
	options,
	placeholder = "Select...",
	className,
	searchPlaceholder = "Search...",
}: SearchableSelectProps) {
	const [open, setOpen] = React.useState(false)
	const [searchQuery, setSearchQuery] = React.useState("")

	// Normalize options to always work with { value, label } format
	const normalizedOptions = React.useMemo(() => {
		if (!options || options.length === 0) {
			return []
		}
		if (typeof options[0] === "string") {
			return (options as string[]).map((opt) => ({ value: opt, label: opt }))
		}
		return options as { value: string; label: string }[]
	}, [options])

	const filteredOptions = React.useMemo(() => {
		if (!searchQuery) return normalizedOptions
		const query = searchQuery.toLowerCase()
		return normalizedOptions.filter((option) =>
			option.label.toLowerCase().includes(query),
		)
	}, [normalizedOptions, searchQuery])

	return (
		<SelectPrimitive.Root
			value={value}
			onValueChange={onValueChange}
			open={open}
			onOpenChange={setOpen}
		>
			<SelectPrimitive.Trigger
				className={cn(
					"flex h-9 w-full items-center justify-between whitespace-nowrap border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
					className,
				)}
			>
				<SelectPrimitive.Value placeholder={placeholder} />
				<SelectPrimitive.Icon asChild>
					<ChevronDown className="h-4 w-4 opacity-50" />
				</SelectPrimitive.Icon>
			</SelectPrimitive.Trigger>
			<SelectPrimitive.Portal>
				<SelectPrimitive.Content
					className={cn(
						"relative z-50 max-h-[400px] min-w-[8rem] overflow-hidden border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
						"data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
					)}
					position="popper"
				>
					<div className="flex items-center border-b px-3 pb-2 pt-2">
						<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
						<Input
							placeholder={searchPlaceholder}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="h-8 border-0 p-0 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
							onKeyDown={(e) => {
								// Prevent the select from closing when typing
								e.stopPropagation()
							}}
						/>
					</div>
					<SelectPrimitive.Viewport className="max-h-[300px] overflow-y-auto p-1">
						{filteredOptions.length === 0 ? (
							<div className="relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground">
								No results found
							</div>
						) : (
							<>
								<SelectPrimitive.Item
									value="all"
									className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-orange focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
								>
									<span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
										<SelectPrimitive.ItemIndicator>
											<Check className="h-4 w-4" />
										</SelectPrimitive.ItemIndicator>
									</span>
									<SelectPrimitive.ItemText>
										All {placeholder?.replace("All ", "")}
									</SelectPrimitive.ItemText>
								</SelectPrimitive.Item>
								{filteredOptions.map((option) => (
									<SelectPrimitive.Item
										key={option.value}
										value={option.value}
										className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-orange focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
									>
										<span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
											<SelectPrimitive.ItemIndicator>
												<Check className="h-4 w-4" />
											</SelectPrimitive.ItemIndicator>
										</span>
										<SelectPrimitive.ItemText>
											{option.label}
										</SelectPrimitive.ItemText>
									</SelectPrimitive.Item>
								))}
							</>
						)}
					</SelectPrimitive.Viewport>
				</SelectPrimitive.Content>
			</SelectPrimitive.Portal>
		</SelectPrimitive.Root>
	)
}
