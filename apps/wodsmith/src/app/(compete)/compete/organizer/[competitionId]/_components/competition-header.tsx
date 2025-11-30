import Link from "next/link"
import { ExternalLink, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CompetitionHeaderProps {
	competition: {
		id: string
		name: string
		slug: string
		description: string | null
	}
}

export function CompetitionHeader({ competition }: CompetitionHeaderProps) {
	return (
		<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
			<div className="flex-1 min-w-0">
				<h1 className="text-3xl font-bold">{competition.name}</h1>
				{competition.description && (
					<p className="text-muted-foreground mt-2">
						{competition.description}
					</p>
				)}
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<Link href={`/compete/organizer/${competition.id}/edit`}>
					<Button variant="outline" size="sm">
						<Pencil className="h-4 w-4 mr-2" />
						Edit
					</Button>
				</Link>
				<Link href={`/compete/${competition.slug}`}>
					<Button variant="outline" size="sm">
						<ExternalLink className="h-4 w-4 mr-2" />
						View Public Page
					</Button>
				</Link>
			</div>
		</div>
	)
}
