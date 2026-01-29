"use client"

import { Link } from "@tanstack/react-router"
import { MapPin, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { CompetitionVenue } from "@/db/schemas/competitions"

interface VenuesSummaryProps {
	competitionId: string
	venues: CompetitionVenue[]
}

export function VenuesSummary({ competitionId, venues }: VenuesSummaryProps) {
	const locationsHref = `/compete/organizer/${competitionId}/locations`

	if (venues.length === 0) {
		return (
			<Card className="border-dashed">
				<CardContent className="py-6 text-center">
					<MapPin className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
					<p className="text-muted-foreground mb-4">No venues created yet.</p>
					<Button asChild>
						<Link to={locationsHref}>
							<Plus className="h-4 w-4 mr-2" />
							Add Venue
						</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-2">
				{venues.map((venue) => (
					<Card key={venue.id} className="flex-1 min-w-[200px]">
						<CardContent className="py-3 px-4">
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2 min-w-0">
									<MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
									<span className="font-medium truncate">{venue.name}</span>
								</div>
								<Badge variant="secondary" className="shrink-0">
									{venue.laneCount} lanes
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
			<Button variant="outline" size="sm" asChild>
				<Link to={locationsHref}>
					<MapPin className="h-4 w-4 mr-2" />
					Manage Locations
				</Link>
			</Button>
		</div>
	)
}
