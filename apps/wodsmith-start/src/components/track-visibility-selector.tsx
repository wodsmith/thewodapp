"use client"

import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProgrammingTrackWithOwner } from "@/server-fns/programming-fns"
import { updateTrackVisibilityFn } from "@/server-fns/programming-fns"

interface TrackVisibilitySelectorProps {
	track: ProgrammingTrackWithOwner
	onVisibilityChange?: (isPublic: boolean) => void
}

export function TrackVisibilitySelector({
	track,
	onVisibilityChange,
}: TrackVisibilitySelectorProps) {
	const [isPublic, setIsPublic] = useState(Boolean(track.isPublic))
	const [isPending, setIsPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleToggleVisibility = async () => {
		setError(null)
		setIsPending(true)

		try {
			const newIsPublic = !isPublic

			const result = await updateTrackVisibilityFn({
				data: {
					trackId: track.id,
					isPublic: newIsPublic,
				},
			})

			if (result.track) {
				setIsPublic(newIsPublic)
				onVisibilityChange?.(newIsPublic)
			} else {
				throw new Error("Failed to update track visibility")
			}
		} catch (err) {
			console.error("Failed to update track visibility:", err)
			setError(
				err instanceof Error
					? err.message
					: "Failed to update track visibility",
			)
		} finally {
			setIsPending(false)
		}
	}

	return (
		<div className="flex items-center gap-2">
			<Badge variant={isPublic ? "default" : "secondary"}>
				{isPublic ? (
					<>
						<Eye className="h-3 w-3 mr-1" />
						Public
					</>
				) : (
					<>
						<EyeOff className="h-3 w-3 mr-1" />
						Private
					</>
				)}
			</Badge>

			<Button
				variant="outline"
				size="sm"
				onClick={handleToggleVisibility}
				disabled={isPending}
				title={isPublic ? "Make Private" : "Make Public"}
			>
				{isPending ? (
					<Loader2 className="h-3 w-3 animate-spin" />
				) : isPublic ? (
					<EyeOff className="h-3 w-3" />
				) : (
					<Eye className="h-3 w-3" />
				)}
			</Button>

			{error && (
				<p className="text-xs text-destructive ml-2" role="alert">
					{error}
				</p>
			)}
		</div>
	)
}
