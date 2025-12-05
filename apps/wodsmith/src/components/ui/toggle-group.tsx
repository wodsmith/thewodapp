import { cn } from "@/lib/utils"

interface ToggleGroupProps {
	value: string
	onValueChange: (value: string) => void
	options: { value: string; label: string }[]
	className?: string
}

export function ToggleGroup({
	value,
	onValueChange,
	options,
	className,
}: ToggleGroupProps) {
	return (
		<div
			className={cn("inline-flex items-center justify-center p-1", className)}
			role="tablist"
			aria-orientation="horizontal"
		>
			{options.map((option) => (
				<button
					key={option.value}
					className={cn(
						"inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
						value === option.value ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shadow-sm" : "hover:opacity-80",
					)}
					type="button"
					role="tab"
					aria-selected={value === option.value}
					onClick={() => onValueChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}
