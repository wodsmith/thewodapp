"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import * as React from "react"

interface CheckboxProps {
	checked?: boolean
	onCheckedChange?: (checked: boolean) => void
	className?: string
	disabled?: boolean
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
	(
		{ className, checked = false, onCheckedChange, disabled = false, ...props },
		ref,
	) => {
		return (
			<label className="relative inline-flex items-center cursor-pointer">
				<input
					type="checkbox"
					ref={ref}
					checked={checked}
					onChange={(e) => onCheckedChange?.(e.target.checked)}
					disabled={disabled}
					className="sr-only"
					{...props}
				/>
				<div
					className={cn(
						"h-4 w-4 shrink-0 rounded-sm border-2 border-primary bg-transparent",
						"focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
						"disabled:cursor-not-allowed disabled:opacity-50",
						checked && "bg-primary text-primary-foreground",
						className,
					)}
				>
					{checked && <Check className="h-3 w-3 text-primary-foreground" />}
				</div>
			</label>
		)
	},
)
Checkbox.displayName = "Checkbox"
