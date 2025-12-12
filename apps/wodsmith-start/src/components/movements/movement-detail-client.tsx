"use client"

interface MovementDetailClientProps {
	movement?: {
		id: string
		name: string
		description?: string
		videoUrl?: string
		category?: string
	}
}

export function MovementDetailClient({ movement }: MovementDetailClientProps) {
	if (!movement) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				Movement not found
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-bold">{movement.name}</h1>
			{movement.category && (
				<div className="inline-block px-2 py-1 bg-muted rounded text-sm">
					{movement.category}
				</div>
			)}
			{movement.description && (
				<p className="text-muted-foreground">{movement.description}</p>
			)}
			{movement.videoUrl && (
				<div className="aspect-video bg-muted rounded flex items-center justify-center">
					<span className="text-muted-foreground">Video placeholder</span>
				</div>
			)}
		</div>
	)
}
