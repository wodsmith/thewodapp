"use client"

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Plus } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/schedule-templates/_components/ScheduleTemplates.tsx
// This is a stub component that displays schedule templates data
// Full component includes: create/edit/delete dialogs, form validation, template class management

interface Template {
	id: string
	name: string
	description: string | null
	isActive: number
	teamId: string
	createdAt: Date
	classes?: Array<{
		id: string
		dayOfWeek: number
		startTime: string
		endTime: string
		classCatalogId: string | null
	}>
}

interface ClassCatalog {
	id: string
	name: string
	description: string | null
	durationMinutes: number
}

interface Location {
	id: string
	name: string
}

interface Skill {
	id: string
	name: string
}

interface ScheduleTemplatesProps {
	templates: Template[]
	classCatalog: ClassCatalog[]
	locations: Location[]
	availableSkills: Skill[]
	teamId: string
	_teamSlug: string
}

export default function ScheduleTemplates({
	templates,
	classCatalog,
	locations,
	availableSkills,
	teamId,
	_teamSlug,
}: ScheduleTemplatesProps) {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold font-mono">Schedule Templates</h2>
					<p className="text-muted-foreground font-mono">
						Manage recurring class schedules for your gym
					</p>
				</div>
				<Button disabled>
					<Plus className="h-4 w-4 mr-2" />
					Create Template
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{templates.length === 0 ? (
					<Card className="col-span-full">
						<CardContent className="py-12 text-center">
							<p className="text-muted-foreground font-mono">
								No schedule templates yet. Create your first template to get started.
							</p>
						</CardContent>
					</Card>
				) : (
					templates.map((template) => (
						<Card key={template.id}>
							<CardHeader>
								<CardTitle className="font-mono">{template.name}</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground font-mono">
									{template.description || "No description"}
								</p>
								<div className="mt-2 text-xs text-muted-foreground">
									{template.classes?.length ?? 0} classes configured
								</div>
							</CardContent>
						</Card>
					))
				)}
			</div>

			{/* Debug info - remove in production */}
			<details className="text-xs text-muted-foreground">
				<summary>Debug: Available Data</summary>
				<pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
					{JSON.stringify(
						{
							teamId,
							templatesCount: templates.length,
							classesCount: classCatalog.length,
							locationsCount: locations.length,
							skillsCount: availableSkills.length,
						},
						null,
						2
					)}
				</pre>
			</details>
		</div>
	)
}
