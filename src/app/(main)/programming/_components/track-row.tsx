import React from "react"
import { Button } from "@/components/ui/button"

export function TrackRow({
	track,
}: {
	track: { id: string; name: string; description: string | null }
}) {
	return (
		<div className="flex items-center px-4 py-2 hover:bg-muted/50">
			<span className="w-48 text-sm font-medium truncate">{track.name}</span>
			{track.description && (
				<span className="flex-1 text-xs text-muted-foreground truncate">
					{track.description}
				</span>
			)}
			<Button
				disabled
				variant="ghost"
				size="sm"
				className="ml-4 whitespace-nowrap"
			>
				Subscribe
			</Button>
		</div>
	)
}
