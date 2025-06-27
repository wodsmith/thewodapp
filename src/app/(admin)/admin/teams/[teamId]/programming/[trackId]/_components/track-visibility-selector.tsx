"use client"

import { ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ProgrammingTrack } from "@/db/schema"
import { updateProgrammingTrackAction } from "../../../_actions/programming-track-actions"

interface TrackVisibilitySelectorProps {
	teamId: string
	track: ProgrammingTrack
}

export function TrackVisibilitySelector({
	teamId,
	track,
}: TrackVisibilitySelectorProps) {
	const [isPublic, setIsPublic] = useState(Boolean(track.isPublic))

	const { execute: updateTrack, isPending } = useServerAction(
		updateProgrammingTrackAction,
	)

	const handleVisibilityChange = async (newIsPublic: boolean) => {
		try {
			const [result, error] = await updateTrack({
				teamId,
				trackId: track.id,
				isPublic: newIsPublic,
			})

			if (error || !result?.success) {
				throw new Error(error?.message || "Failed to update track visibility")
			}

			setIsPublic(newIsPublic)
			toast.success(`Track is now ${newIsPublic ? "public" : "private"}`)
		} catch (error) {
			console.error("Failed to update track visibility:", error)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update track visibility",
			)
		}
	}

	return (
		<div className="flex items-center space-x-2">
			<Badge
				variant={isPublic ? "default" : "secondary"}
				className="text-md font-mono "
			>
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

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						disabled={isPending}
						className="border-2 border-primary shadow-[2px_2px_0px_0px] shadow-primary hover:shadow-[1px_1px_0px_0px] transition-all font-mono rounded-none"
					>
						{isPending ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<ChevronDown className="h-3 w-3" />
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="border-2 border-primary rounded-none font-mono"
				>
					<DropdownMenuItem
						onClick={() => handleVisibilityChange(true)}
						disabled={isPending || isPublic}
						className="cursor-pointer"
					>
						<Eye className="h-4 w-4 mr-2" />
						Make Public
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => handleVisibilityChange(false)}
						disabled={isPending || !isPublic}
						className="cursor-pointer"
					>
						<EyeOff className="h-4 w-4 mr-2" />
						Make Private
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
