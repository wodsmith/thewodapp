import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/utils/cn"

interface EmptyStateProps {
	icon?: LucideIcon
	title: string
	description: string
	children?: React.ReactNode
	className?: string
}

/**
 * Reusable empty state component for organizer pages.
 * Displays a card with an optional icon, title, description, and action buttons.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	children,
	className,
}: EmptyStateProps) {
	return (
		<Card className={cn("border-dashed", className)}>
			<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
				{Icon && <Icon className="h-10 w-10 text-muted-foreground/50 mb-4" />}
				<h3 className="text-lg font-medium mb-1">{title}</h3>
				<p className="text-sm text-muted-foreground max-w-md mb-4">
					{description}
				</p>
				{children && <div className="flex gap-2">{children}</div>}
			</div>
		</Card>
	)
}
