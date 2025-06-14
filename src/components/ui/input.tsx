import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex h-9 w-full border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-dark-input dark:bg-dark-background dark:text-dark-foreground dark:focus-visible:ring-dark-ring dark:placeholder:text-dark-muted-foreground",
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
