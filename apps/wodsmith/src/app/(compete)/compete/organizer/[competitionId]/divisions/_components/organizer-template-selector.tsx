"use client"

import { Layers, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { initializeCompetitionDivisionsAction } from "@/actions/competition-division-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"

interface ScalingGroupWithLevels {
	id: string
	title: string
	description: string | null
	isSystem: number
	levels: Array<{
		id: string
		label: string
		position: number
	}>
}

interface OrganizerTemplateSelectorProps {
	teamId: string
	competitionId: string
	scalingGroups: ScalingGroupWithLevels[]
	onSuccess: () => void
}

export function OrganizerTemplateSelector({
	teamId,
	competitionId,
	scalingGroups,
	onSuccess,
}: OrganizerTemplateSelectorProps) {
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")

	const { execute: initializeDivisions, isPending } = useServerAction(
		initializeCompetitionDivisionsAction,
	)

	const selectedTemplate = scalingGroups.find((g) => g.id === selectedTemplateId)

	const handleApplyTemplate = async () => {
		const [_result, error] = await initializeDivisions({
			teamId,
			competitionId,
			templateGroupId: selectedTemplateId || undefined,
		})

		if (error) {
			toast.error(error.message || "Failed to initialize divisions")
		} else {
			toast.success(
				selectedTemplateId
					? "Divisions created from template"
					: "Default divisions created",
			)
			onSuccess()
		}
	}

	const handleStartFresh = async () => {
		const [_result, error] = await initializeDivisions({
			teamId,
			competitionId,
		})

		if (error) {
			toast.error(error.message || "Failed to initialize divisions")
		} else {
			toast.success("Default divisions created")
			onSuccess()
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Layers className="h-5 w-5" />
					Set Up Divisions
				</CardTitle>
				<CardDescription>
					Create divisions for athletes to register in. You can start from a
					template or create your own.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="template-select">Select a Template</Label>
					<Select
						value={selectedTemplateId}
						onValueChange={setSelectedTemplateId}
					>
						<SelectTrigger>
							<SelectValue placeholder="Choose a template (optional)" />
						</SelectTrigger>
						<SelectContent>
							{scalingGroups.map((group) => (
								<SelectItem key={group.id} value={group.id}>
									<div className="flex items-center gap-2">
										{group.title}
										{group.isSystem === 1 && (
											<Badge variant="secondary" className="text-xs">
												System
											</Badge>
										)}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{selectedTemplate && (
					<div className="rounded-lg border p-3 bg-muted/50">
						<p className="text-sm font-medium mb-2">Preview:</p>
						<div className="flex flex-wrap gap-2">
							{selectedTemplate.levels
								.sort((a, b) => a.position - b.position)
								.map((level) => (
									<Badge key={level.id} variant="outline">
										{level.label}
									</Badge>
								))}
						</div>
					</div>
				)}

				<div className="flex gap-2">
					<Button
						onClick={handleApplyTemplate}
						disabled={isPending || !selectedTemplateId}
					>
						{isPending ? "Creating..." : "Apply Template"}
					</Button>
					<Button
						variant="outline"
						onClick={handleStartFresh}
						disabled={isPending}
					>
						<Plus className="h-4 w-4 mr-2" />
						Start Fresh
					</Button>
				</div>

				<p className="text-xs text-muted-foreground">
					"Start Fresh" creates Open and Scaled divisions. You can customize
					them after.
				</p>
			</CardContent>
		</Card>
	)
}
