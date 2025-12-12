import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "~/lib/utils"

const badgeVariants = cva(
	"inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-black dark:bg-primary text-primary-foreground hover:bg-primary/80",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
				outline: "text-foreground",
				rx: "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
				"rx+":
					"border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
				scaled:
					"border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
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
				className:
					"hover:bg-primary/80 hover:dark:text-secondary-foreground dark:text-muted-foreground",
			},
			{
				variant: "secondary",
				clickable: true,
				className:
					"hover:bg-border dark:hover:bg-secondary hover:dark:text-secondary-foreground dark:text-muted-foreground",
			},
			{
				variant: "destructive",
				clickable: true,
				className:
					"hover:bg-destructive/80 hover:dark:text-secondary-foreground dark:text-muted-foreground",
			},
			{
				variant: "rx",
				clickable: true,
				className:
					"hover:bg-green-200 dark:hover:bg-green-800 hover:dark:text-secondary-foreground dark:text-muted-foreground",
			},
			{
				variant: "rx+",
				clickable: true,
				className:
					"hover:bg-red-200 dark:hover:bg-red-800 hover:dark:text-secondary-foreground dark:text-muted-foreground",
			},
			{
				variant: "scaled",
				clickable: true,
				className:
					"hover:bg-yellow-200 dark:hover:bg-yellow-800 hover:dark:text-secondary-foreground dark:text-muted-foreground",
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
