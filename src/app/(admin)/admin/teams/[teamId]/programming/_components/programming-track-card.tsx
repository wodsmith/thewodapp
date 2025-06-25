"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProgrammingTrack } from "@/db/schema"
import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"
import { Edit, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ProgrammingTrackDeleteDialog } from "./programming-track-delete-dialog"

interface ProgrammingTrackCardProps {
	track: ProgrammingTrack
	teamId: string
	onDeletedAction: () => void
}

export function ProgrammingTrackCard({
	track,
	teamId,
	onDeletedAction,
}: ProgrammingTrackCardProps) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
	const pathname = usePathname()

	const getTypeColor = (type: string) => {
		switch (type) {
			case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
				return "bg-green-500 text-white border-2 border-green-700 font-mono"
			case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
				return "bg-blue-500 text-white border-2 border-blue-700 font-mono"
			case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
				return "bg-purple-500 text-white border-2 border-purple-700 font-mono"
			default:
				return "bg-gray-500 text-white border-2 border-gray-700 font-mono"
		}
	}

	const getTypeLabel = (type: string) => {
		switch (type) {
			case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
				return "Self-programmed"
			case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
				return "Team-owned"
			case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
				return "3rd Party"
			default:
				return type
		}
	}

	const handleDeleted = () => {
		onDeletedAction()
		setIsDeleteDialogOpen(false)
	}

	console.log(pathname)

	return (
		<Card className="h-full border-4 border-primary shadow-[6px_6px_0px_0px] shadow-primary bg-surface rounded-none">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<CardTitle className="text-lg font-mono tracking-tight">
							{track.name}
						</CardTitle>
						<div className="flex items-center gap-2">
							<Badge className={getTypeColor(track.type)}>
								{getTypeLabel(track.type)}
							</Badge>
							{track.isPublic ? (
								<Badge className="bg-orange-500 text-white border-2 border-orange-700 font-mono">
									<Users className="h-3 w-3 mr-1" />
									Public
								</Badge>
							) : (
								<Badge className="bg-gray-500 text-white border-2 border-gray-700 font-mono">
									Private
								</Badge>
							)}
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				{track.description && (
					<p className="text-sm text-muted-foreground mb-4 line-clamp-3 font-mono">
						{track.description}
					</p>
				)}
				<div className="flex items-center gap-2">
					<Link
						href={`/admin/teams/${teamId}/programming/${track.id}`}
						className="flex p-2 justify-center items-center border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-orange text-primary hover:bg-surface"
					>
						<Edit className="h-4 w-4 mr-2" />
						Edit
					</Link>
					<ProgrammingTrackDeleteDialog
						track={track}
						teamId={teamId}
						trigger={
							<Button className="border-2 border-white shadow-[4px_4px_0px_0px] shadow-white hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-black text-white hover:bg-red-500">
								<Trash2 className="h-4 w-4" />
							</Button>
						}
						onDeletedAction={handleDeleted}
						open={isDeleteDialogOpen}
						onOpenChange={setIsDeleteDialogOpen}
					/>
				</div>
			</CardContent>
		</Card>
	)
}
