import React from "react"
import { getPublicProgrammingTracks } from "@/server/programming-tracks"
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function ProgrammingTracksPage() {
	const tracks = await getPublicProgrammingTracks()

	console.log(`PAGE: /programming rendered ${tracks.length} tracks`)

	return (
		<div className="container mx-auto py-8 space-y-8">
			<h1 className="text-2xl font-bold tracking-tight">Programming Tracks</h1>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{tracks.map((track) => (
					<Card key={track.id} className="flex flex-col justify-between">
						<div>
							<CardHeader>
								<CardTitle>{track.name}</CardTitle>
								{track.description && (
									<CardDescription>{track.description}</CardDescription>
								)}
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground font-mono mb-4">
									{track.type}
								</p>
							</CardContent>
						</div>
						<CardContent>
							<Button disabled className="w-full" variant="secondary">
								Subscribe (coming soon)
							</Button>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
