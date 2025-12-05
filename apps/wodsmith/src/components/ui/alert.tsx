import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Alert variants following WODsmith Design System
 * - Semantic colors for different alert types
 * - Consistent padding and border radius
 */
const alertVariants = cva(
	"relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
	{
		variants: {
			variant: {
				default: "bg-background text-foreground border-border [&>svg]:text-foreground",
				destructive:
					"border-error-500/50 bg-error-50 text-error-600 dark:border-error-500/50 dark:bg-error-900/20 dark:text-error-500 [&>svg]:text-error-500",
				success:
					"border-success-500/50 bg-success-50 text-success-600 dark:border-success-500/50 dark:bg-success-900/20 dark:text-success-500 [&>svg]:text-success-500",
				warning:
					"border-warning-500/50 bg-warning-50 text-warning-600 dark:border-warning-500/50 dark:bg-warning-900/20 dark:text-warning-500 [&>svg]:text-warning-500",
				info:
					"border-info-500/50 bg-info-50 text-info-600 dark:border-info-500/50 dark:bg-info-900/20 dark:text-info-500 [&>svg]:text-info-500",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
)

const Alert = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
	<div
		ref={ref}
		role="alert"
		className={cn(alertVariants({ variant }), className)}
		{...props}
	/>
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h5
		ref={ref}
		className={cn("mb-1 font-medium leading-none tracking-tight", className)}
		{...props}
	/>
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("text-sm [&_p]:leading-relaxed", className)}
		{...props}
	/>
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
