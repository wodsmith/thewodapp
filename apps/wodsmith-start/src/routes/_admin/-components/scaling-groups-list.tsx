"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Plus, Star, GripVertical } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/scaling/_components/scaling-groups-list.tsx
// This is a stub component that displays scaling groups
// Full component includes: create/edit/delete dialogs, set default, reorder levels

interface ScalingGroup {
	id: string
	title: string
	description: string | null
	teamId: string | null
	isDefault: number
	isSystem: number
	levels?: Array<{
		id: string
		label: string
		position: number
	}>
	_count?: {
		workouts: number
		tracks: number
	}
}

interface ScalingGroupsListProps {
	teamId: string
	teamSlug: string
	scalingGroups: ScalingGroup[]
	defaultScalingGroupId: string | null | undefined
	canCreate: boolean
	canEdit: boolean
	canDelete: boolean
	canEditTeamSettings: boolean
}

export function ScalingGroupsList({
	teamId,
	teamSlug,
	scalingGroups,
	defaultScalingGroupId,
	canCreate,
	canEdit,
	canDelete,
	canEditTeamSettings,
}: ScalingGroupsListProps) {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold font-mono">Scaling Groups</h2>
					<p className="text-muted-foreground font-mono">
						Define scaling levels for workouts (RX, Scaled, etc.)
					</p>
				</div>
				{canCreate && (
					<Button disabled>
						<Plus className="h-4 w-4 mr-2" />
						Create Scaling Group
					</Button>
				)}
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{scalingGroups.length === 0 ? (
					<Card className="col-span-full">
						<CardContent className="py-12 text-center">
							<p className="text-muted-foreground font-mono">
								No scaling groups defined yet. Create your first scaling group to define
								workout difficulty levels.
							</p>
						</CardContent>
					</Card>
				) : (
					scalingGroups.map((group) => (
						<Card key={group.id} className={group.id === defaultScalingGroupId ? "border-primary" : ""}>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 font-mono">
									{group.title}
									{group.id === defaultScalingGroupId && (
										<Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
									)}
									{group.isSystem === 1 && (
										<Badge variant="outline" className="font-mono text-xs">
											System
										</Badge>
									)}
								</CardTitle>
								{group.description && (
									<CardDescription className="font-mono">
										{group.description}
									</CardDescription>
								)}
							</CardHeader>
							<CardContent className="space-y-3">
								{/* Levels */}
								{group.levels && group.levels.length > 0 && (
									<div className="space-y-1">
										<span className="text-xs text-muted-foreground font-mono">Levels:</span>
										<div className="flex flex-wrap gap-1">
											{group.levels
												.sort((a, b) => a.position - b.position)
												.map((level) => (
													<Badge
														key={level.id}
														variant="secondary"
														className="font-mono text-xs"
													>
														<GripVertical className="h-3 w-3 mr-1 opacity-50" />
														{level.label}
													</Badge>
												))}
										</div>
									</div>
								)}

								{/* Usage stats */}
								{group._count && (
									<div className="text-xs text-muted-foreground font-mono">
										{group._count.workouts} workouts • {group._count.tracks} tracks
									</div>
								)}
							</CardContent>
						</Card>
					))
				)}
			</div>

			{/* Debug info */}
			<details className="text-xs text-muted-foreground">
				<summary>Debug: Data Summary</summary>
				<pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
					{JSON.stringify(
						{
							teamId,
							teamSlug,
							groupsCount: scalingGroups.length,
							defaultScalingGroupId,
							canCreate,
							canEdit,
							canDelete,
							canEditTeamSettings,
						},
						null,
						2
					)}
				</pre>
			</details>
		</div>
	)
}
