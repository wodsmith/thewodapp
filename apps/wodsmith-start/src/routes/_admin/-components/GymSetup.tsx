"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { MapPin, Settings, Plus } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/gym-setup/_components/GymSetup.tsx
// This is a stub component that displays gym setup data
// Full component includes: location/skill management, country settings, create/delete actions

interface Location {
	id: string
	name: string
	description: string | null
	teamId: string
}

interface Skill {
	id: string
	name: string
	description: string | null
	teamId: string
}

interface Team {
	id: string
	name: string
	slug: string
	settings: string | null
}

interface GymSetupProps {
	locations: Location[] | null
	skills: Skill[] | null
	team: Team | null
	teamId: string
}

export default function GymSetup({
	locations,
	skills,
	team,
	teamId,
}: GymSetupProps) {
	const locationsList = locations ?? []
	const skillsList = skills ?? []
	
	let currentSettings: { country?: string } = {}
	try {
		currentSettings = JSON.parse(team?.settings || "{}")
	} catch {
		// ignore parse errors
	}

	return (
		<div className="space-y-8">
			{/* Team Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 font-mono">
						<Settings className="h-5 w-5" />
						Team Settings
					</CardTitle>
					<CardDescription className="font-mono">
						Configure your gym's basic settings
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-sm font-mono">
						<span className="text-muted-foreground">Country:</span>{" "}
						{currentSettings.country || "Not set"}
					</div>
				</CardContent>
			</Card>

			{/* Locations */}
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<div>
							<CardTitle className="flex items-center gap-2 font-mono">
								<MapPin className="h-5 w-5" />
								Locations
							</CardTitle>
							<CardDescription className="font-mono">
								Manage gym locations for class scheduling
							</CardDescription>
						</div>
						<Button size="sm" disabled>
							<Plus className="h-4 w-4 mr-2" />
							Add Location
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{locationsList.length === 0 ? (
						<p className="text-muted-foreground font-mono text-sm">
							No locations configured yet.
						</p>
					) : (
						<div className="space-y-2">
							{locationsList.map((location) => (
								<div
									key={location.id}
									className="flex items-center justify-between p-2 border rounded"
								>
									<span className="font-mono">{location.name}</span>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Skills */}
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<div>
							<CardTitle className="font-mono">Skills</CardTitle>
							<CardDescription className="font-mono">
								Define skills that coaches can specialize in
							</CardDescription>
						</div>
						<Button size="sm" disabled>
							<Plus className="h-4 w-4 mr-2" />
							Add Skill
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{skillsList.length === 0 ? (
						<p className="text-muted-foreground font-mono text-sm">
							No skills defined yet.
						</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{skillsList.map((skill) => (
								<Badge key={skill.id} variant="secondary" className="font-mono">
									{skill.name}
								</Badge>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Debug info */}
			<details className="text-xs text-muted-foreground">
				<summary>Debug: Data Summary</summary>
				<pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
					{JSON.stringify(
						{
							teamId,
							teamName: team?.name,
							locationsCount: locationsList.length,
							skillsCount: skillsList.length,
						},
						null,
						2
					)}
				</pre>
			</details>
		</div>
	)
}
