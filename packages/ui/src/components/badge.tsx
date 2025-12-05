import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "../lib/utils"

/**
 * Badge variants following WODsmith Design System
 * - Text-xs with font-medium
 * - Padding: px-2 py-0.5 to px-2 py-1
 * - Colored backgrounds: orange (active), gray (neutral), green (success), yellow (warning), red (error)
 */
const badgeVariants = cva(
	"inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
	{
		variants: {
			variant: {
				default:
					"bg-orange-500 text-white",
				secondary:
					"border border-border bg-secondary text-secondary-foreground",
				outline:
					"border border-border text-foreground bg-transparent",
				destructive:
					"bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-500",
				success:
					"bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-500",
				warning:
					"bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-500",
				info:
					"bg-info-100 text-info-600 dark:bg-info-900/30 dark:text-info-500",
				// Domain-specific variants (RX badges for workouts)
				rx: "bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-500",
				"rx+": "bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-500",
				scaled:
					"bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-500",
			},
			size: {
				default: "px-2 py-0.5",
				sm: "px-1.5 py-0.5 text-[10px]",
				lg: "px-2.5 py-1",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
	return (
		<div
			className={cn(badgeVariants({ variant, size }), className)}
			{...props}
		/>
	)
}

export { Badge, badgeVariants }
