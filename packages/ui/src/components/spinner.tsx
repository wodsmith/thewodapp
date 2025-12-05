import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import type React from "react"
import { cn } from "../lib/utils"

const spinnerVariants = cva("flex-col items-center justify-center", {
	variants: {
		show: {
			true: "flex",
			false: "hidden",
		},
	},
	defaultVariants: {
		show: true,
	},
})

const loaderVariants = cva("animate-spin text-orange-500", {
	variants: {
		size: {
			small: "size-6",
			medium: "size-8",
			large: "size-12",
		},
	},
	defaultVariants: {
		size: "medium",
	},
})

interface SpinnerContentProps
	extends VariantProps<typeof spinnerVariants>,
		VariantProps<typeof loaderVariants> {
	className?: string
	children?: React.ReactNode
}

/**
 * Spinner component following WODsmith Design System
 * Uses orange color for brand consistency
 */
export function Spinner({
	size,
	show,
	children,
	className,
}: SpinnerContentProps) {
	return (
		<span className={spinnerVariants({ show })}>
			<Loader2 className={cn(loaderVariants({ size }), className)} />
			{children}
		</span>
	)
}
