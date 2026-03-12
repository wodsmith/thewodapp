import { HelpCircle } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ScalingLevel } from "@/db/schema"
import type { PublicCompetitionDivision } from "@/server-fns/competition-divisions-fns"

export function DivisionBreakdownDialog({
	scalingLevels,
	publicDivisions,
}: {
	scalingLevels: ScalingLevel[]
	publicDivisions: PublicCompetitionDivision[]
}) {
	const [open, setOpen] = useState(false)

	// Only show divisions that have descriptions
	const divisionsWithDescriptions = scalingLevels
		.map((level) => {
			const publicDiv = publicDivisions.find((d) => d.id === level.id)
			return {
				...level,
				description: publicDiv?.description ?? null,
			}
		})
		.filter((d) => d.description)

	if (divisionsWithDescriptions.length === 0) {
		return null
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<HelpCircle className="h-4 w-4" />
					Not sure which division to choose?
				</button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl max-h-[85vh] p-0">
				<DialogHeader className="px-6 pt-6 pb-0">
					<DialogTitle>Division Breakdown</DialogTitle>
					<DialogDescription>
						Compare divisions to find the best fit for your skill level
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="px-6 pb-6 max-h-[calc(85vh-5rem)]">
					<div className="space-y-6 pr-4">
						{divisionsWithDescriptions.map((division) => (
							<div
								key={division.id}
								className="rounded-lg border bg-card p-4 space-y-2"
							>
								<div className="flex items-center gap-2">
									<h3 className="font-semibold text-base">{division.label}</h3>
									{(division.teamSize ?? 1) > 1 && (
										<Badge variant="secondary" className="text-xs">
											Team of {division.teamSize}
										</Badge>
									)}
								</div>
								<p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
									{division.description}
								</p>
							</div>
						))}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}
