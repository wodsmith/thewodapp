import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input component following WODsmith Design System
 * - Gray border by default
 * - Orange focus ring (2px)
 * - Standard padding: px-3 py-2.5
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base transition-colors duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Input.displayName = "Input"

export { Input }
