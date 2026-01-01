import { Link } from "@tanstack/react-router"
import { Dumbbell, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ListItem } from "@/components/ui/list-item"
import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"
import type { TeamProgrammingTrack } from "@/server-fns/programming-fns"

interface ProgrammingTrackRowProps {
	track: TeamProgrammingTrack
	teamId: string
	/** Optional link prefix for the track detail page. Defaults to /settings/programming */
	linkPrefix?: string
}

export function ProgrammingTrackRow({
	track,
	teamId: _teamId,
	linkPrefix = "/settings/programming",
}: ProgrammingTrackRowProps) {
	const getTypeColor = (type: string) => {
		switch (type) {
			case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
				return "bg-green-500 text-white"
			case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
				return "bg-blue-500 text-white"
			case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
				return "bg-purple-500 text-white"
			default:
				return "bg-gray-500 text-white"
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

	return (
		<ListItem className="group hover:bg-muted/50 transition-colors">
			<ListItem.Content className="flex-1 min-w-0">
				<div className="flex items-start gap-3 flex-col sm:flex-row sm:items-center w-full">
					<Link
						to={`${linkPrefix}/${track.id}` as "/"}
						className="font-semibold text-lg hover:underline underline-offset-4 truncate"
					>
						{track.name}
					</Link>
					{track.description && (
						<p className="text-sm text-muted-foreground line-clamp-2 sm:max-w-md">
							{track.description}
						</p>
					)}
				</div>
			</ListItem.Content>

			<ListItem.Actions className="flex-wrap gap-2">
				<Badge className={getTypeColor(track.type)}>
					{getTypeLabel(track.type)}
				</Badge>
				{track.isPublic === 1 ? (
					<Badge className="bg-orange-500 text-white">
						<Users className="h-3 w-3 mr-1" />
						Public
					</Badge>
				) : (
					<Badge variant="secondary">Private</Badge>
				)}
				{track.scalingGroupId && (
					<Badge className="bg-purple-500 text-white">
						<Dumbbell className="h-3 w-3 mr-1" />
						Scaling
					</Badge>
				)}
			</ListItem.Actions>
		</ListItem>
	)
}
