import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Badge variants following WODsmith Design System
 * - Text-xs with font-medium
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
				destructive:
					"bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-500",
				outline: "border border-border text-foreground bg-transparent",
				success:
					"bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-500",
				warning:
					"bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-500",
				info:
					"bg-info-100 text-info-600 dark:bg-info-900/30 dark:text-info-500",
				rx: "bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-500",
				"rx+":
					"bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-500",
				scaled:
					"bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-500",
			},
			clickable: {
				true: "",
				false: "",
			},
		},
		compoundVariants: [
			{
				variant: "default",
				clickable: true,
				className: "hover:bg-orange-600 cursor-pointer",
			},
			{
				variant: "secondary",
				clickable: true,
				className: "hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 cursor-pointer",
			},
			{
				variant: "destructive",
				clickable: true,
				className: "hover:bg-error-200 dark:hover:bg-error-800/40 cursor-pointer",
			},
			{
				variant: "rx",
				clickable: true,
				className: "hover:bg-success-200 dark:hover:bg-success-800/40 cursor-pointer",
			},
			{
				variant: "rx+",
				clickable: true,
				className: "hover:bg-error-200 dark:hover:bg-error-800/40 cursor-pointer",
			},
			{
				variant: "scaled",
				clickable: true,
				className: "hover:bg-warning-200 dark:hover:bg-warning-800/40 cursor-pointer",
			},
		],
		defaultVariants: {
			variant: "default",
		},
	},
)

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, clickable, ...props }: BadgeProps) {
	return (
		<div
			className={cn(badgeVariants({ variant, clickable }), className)}
			{...props}
		/>
	)
}

export { Badge, badgeVariants }
