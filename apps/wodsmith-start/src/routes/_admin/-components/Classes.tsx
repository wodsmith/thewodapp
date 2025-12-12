"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Plus, BookOpen, Clock, Users } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/classes/_components/Classes.tsx
// This is a stub component that displays class catalog data
// Full component includes: create/delete class dialogs, form validation

interface ClassCatalog {
	id: string
	name: string
	description: string | null
	durationMinutes: number
	maxParticipants: number | null
	teamId: string
	skillId: string | null
	skill?: {
		id: string
		name: string
	} | null
}

interface Skill {
	id: string
	name: string
}

interface ClassesProps {
	classes: ClassCatalog[] | null
	availableSkills: Skill[] | null
	teamId: string
	teamSlug: string
}

export default function Classes({
	classes,
	availableSkills,
	teamId,
	teamSlug,
}: ClassesProps) {
	const classesList = classes ?? []
	const skillsList = availableSkills ?? []

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold font-mono">Class Catalog</h2>
					<p className="text-muted-foreground font-mono">
						Define class types that can be scheduled
					</p>
				</div>
				<Button disabled>
					<Plus className="h-4 w-4 mr-2" />
					Create Class
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{classesList.length === 0 ? (
					<Card className="col-span-full">
						<CardContent className="py-12 text-center">
							<p className="text-muted-foreground font-mono">
								No classes defined yet. Create your first class type to get started.
							</p>
						</CardContent>
					</Card>
				) : (
					classesList.map((cls) => (
						<Card key={cls.id}>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 font-mono">
									<BookOpen className="h-4 w-4" />
									{cls.name}
								</CardTitle>
								{cls.description && (
									<CardDescription className="font-mono">
										{cls.description}
									</CardDescription>
								)}
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
									<span className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										{cls.durationMinutes} min
									</span>
									{cls.maxParticipants && (
										<span className="flex items-center gap-1">
											<Users className="h-3 w-3" />
											Max {cls.maxParticipants}
										</span>
									)}
								</div>
								{cls.skill && (
									<Badge variant="secondary" className="font-mono text-xs">
										{cls.skill.name}
									</Badge>
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
							classesCount: classesList.length,
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
