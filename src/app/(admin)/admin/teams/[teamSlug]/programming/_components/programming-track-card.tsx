"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProgrammingTrack } from "@/db/schema"
import { Edit, Trash2, Users } from "lucide-react"
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

	const getTypeColor = (type: string) => {
		switch (type) {
			case "pre_built":
				return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
			case "self_programmed":
				return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
			case "hybrid":
				return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
			default:
				return "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
		}
	}

	const getTypeLabel = (type: string) => {
		switch (type) {
			case "pre_built":
				return "Pre-built"
			case "self_programmed":
				return "Self-programmed"
			case "hybrid":
				return "Hybrid"
			default:
				return type
		}
	}

	const handleDeleted = () => {
		onDeletedAction()
		setIsDeleteDialogOpen(false)
	}

	return (
		<Card className="h-full">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<CardTitle className="text-lg">{track.name}</CardTitle>
						<div className="flex items-center gap-2">
							<Badge className={getTypeColor(track.type)}>
								{getTypeLabel(track.type)}
							</Badge>
							{track.isPublic ? (
								<Badge variant="secondary">
									<Users className="h-3 w-3 mr-1" />
									Public
								</Badge>
							) : (
								<Badge variant="outline">Private</Badge>
							)}
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				{track.description && (
					<p className="text-sm text-muted-foreground mb-4 line-clamp-3">
						{track.description}
					</p>
				)}
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" className="flex-1">
						<Edit className="h-4 w-4 mr-2" />
						Edit
					</Button>
					<ProgrammingTrackDeleteDialog
						track={track}
						teamId={teamId}
						trigger={
							<Button
								variant="outline"
								size="sm"
								className="text-red-600 hover:text-red-700"
							>
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
