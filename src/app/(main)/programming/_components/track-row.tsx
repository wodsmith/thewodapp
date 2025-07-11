import React from "react"
import Link from "next/link"
import { SubscribeButton } from "@/components/programming/subscribe-button"

interface Team {
	id: string
	name: string
}

export function TrackRow({
	track,
	isSubscribed = false,
	userTeams = [],
	subscribeAction,
	unsubscribeAction,
}: {
	track: { id: string; name: string; description: string | null }
	isSubscribed?: boolean
	userTeams?: Team[]
	subscribeAction: (input: { trackId: string; teamId?: string }) => Promise<any>
	unsubscribeAction: (input: {
		trackId: string
		teamId?: string
	}) => Promise<any>
}) {
	return (
		<div className="flex items-center px-4 py-2 hover:bg-muted/50">
			<Link
				href={`/programming/${track.id}`}
				className="flex items-center flex-1"
			>
				<span className="w-48 text-sm font-medium truncate">{track.name}</span>
				{track.description && (
					<span className="flex-1 text-xs text-muted-foreground truncate">
						{track.description}
					</span>
				)}
			</Link>
			<SubscribeButton
				trackId={track.id}
				className="ml-4"
				isSubscribed={isSubscribed}
				userTeams={userTeams}
				subscribeAction={subscribeAction}
				unsubscribeAction={unsubscribeAction}
			/>
		</div>
	)
}
