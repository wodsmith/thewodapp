import * as React from "react"

import { cn } from "../lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
	/** Optional icon to display on the left side */
	leftIcon?: React.ReactNode
	/** Optional icon/button to display on the right side */
	rightIcon?: React.ReactNode
}

/**
 * Input component following WODsmith Design System
 * - Gray border by default
 * - Orange focus ring (2px)
 * - Standard padding: px-3 py-2.5
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, leftIcon, rightIcon, ...props }, ref) => {
		if (leftIcon || rightIcon) {
			return (
				<div className="relative">
					{leftIcon && (
						<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
							{leftIcon}
						</div>
					)}
					<input
						type={type}
						className={cn(
							"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base transition-colors duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
							leftIcon && "pl-10",
							rightIcon && "pr-10",
							className,
						)}
						ref={ref}
						{...props}
					/>
					{rightIcon && (
						<div className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
							{rightIcon}
						</div>
					)}
				</div>
			)
		}

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
