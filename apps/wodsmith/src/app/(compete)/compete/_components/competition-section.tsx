import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"

interface CompetitionSectionProps {
	title: string
	count: number
	children: ReactNode
	emptyMessage?: string
}

export function CompetitionSection({
	title,
	count,
	children,
	emptyMessage,
}: CompetitionSectionProps) {
	if (count === 0 && !emptyMessage) return null

	return (
		<section className="space-y-2">
			<div className="flex items-center gap-2 px-4">
				<h2 className="text-lg font-semibold">{title}</h2>
				<Badge variant="outline">{count}</Badge>
			</div>
			{count === 0 ? (
				<p className="text-sm text-muted-foreground px-4">{emptyMessage}</p>
			) : (
				<div className="border rounded-lg overflow-hidden">{children}</div>
			)}
		</section>
	)
}
