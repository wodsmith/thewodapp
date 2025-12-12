"use client"

import { ArrowRight, RotateCcw } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { Label } from "~/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import type { ScalingLevel, WorkoutScalingDescription } from "~/db/schema"

export interface DescriptionMapping {
	originalScalingLevelId: string
	newScalingLevelId: string
	description: string
}

interface ScalingMigrationMapperProps {
	originalWorkout: {
		id: string
		name: string
	}
	originalDescriptions: (WorkoutScalingDescription & {
		scalingLevel: ScalingLevel
	})[]
	newScalingLevels: ScalingLevel[]
	onMigrate: (mappings: DescriptionMapping[]) => void
	onSkip: () => void
	isLoading?: boolean
}

function generateSmartMapping(
	originalDescriptions: (WorkoutScalingDescription & {
		scalingLevel: ScalingLevel
	})[],
	newScalingLevels: ScalingLevel[],
): Record<string, string> {
	const mappings: Record<string, string> = {}

	// Early guard: if no new scaling levels available, return empty mappings
	if (newScalingLevels.length === 0) {
		return mappings
	}

	// Sort both arrays by position for positional mapping
	const sortedOriginal = [...originalDescriptions].sort(
		(a, b) => a.scalingLevel.position - b.scalingLevel.position,
	)
	const sortedNew = [...newScalingLevels].sort(
		(a, b) => a.position - b.position,
	)

	for (let i = 0; i < sortedOriginal.length; i++) {
		const originalDesc = sortedOriginal[i]
		if (!originalDesc) continue

		// Strategy 1: Exact label match (case insensitive)
		const exactMatch = newScalingLevels.find(
			(level) =>
				level.label.toLowerCase() ===
				originalDesc.scalingLevel.label.toLowerCase(),
		)

		if (exactMatch) {
			mappings[originalDesc.scalingLevelId] = exactMatch.id
			continue
		}

		// Strategy 2: Fuzzy label match (contains similar keywords)
		const fuzzyMatch = newScalingLevels.find((level) => {
			const newLabel = level.label.toLowerCase()
			const originalLabel = originalDesc.scalingLevel.label.toLowerCase()

			// Check for common scaling keywords
			const keywords = ["rx", "scaled", "beginner", "intermediate", "advanced"]
			return keywords.some(
				(keyword) =>
					newLabel.includes(keyword) && originalLabel.includes(keyword),
			)
		})

		if (fuzzyMatch) {
			mappings[originalDesc.scalingLevelId] = fuzzyMatch.id
			continue
		}

		// Strategy 3: Positional mapping (same relative position)
		const newLevel = sortedNew[i]
		if (newLevel) {
			mappings[originalDesc.scalingLevelId] = newLevel.id
		} else if (sortedNew.length > 0) {
			// Fallback to the last level if we run out of positions
			const lastLevel = sortedNew[sortedNew.length - 1]
			if (lastLevel) {
				mappings[originalDesc.scalingLevelId] = lastLevel.id
			}
		}
		// Note: If sortedNew.length === 0, the description remains unmapped (no mapping entry)
	}

	return mappings
}

export function ScalingMigrationMapper({
	originalWorkout,
	originalDescriptions,
	newScalingLevels,
	onMigrate,
	onSkip,
	isLoading = false,
}: ScalingMigrationMapperProps) {
	// Generate smart initial mappings
	const smartMappings = generateSmartMapping(
		originalDescriptions,
		newScalingLevels,
	)

	const [mappings, setMappings] =
		useState<Record<string, string>>(smartMappings)
	const [descriptions, setDescriptions] = useState<Record<string, string>>(
		Object.fromEntries(
			originalDescriptions.map((desc) => [
				desc.scalingLevelId,
				desc.description || "",
			]),
		),
	)

	const handleMappingChange = (originalLevelId: string, newLevelId: string) => {
		setMappings((prev) => ({
			...prev,
			[originalLevelId]: newLevelId,
		}))
	}

	const handleDescriptionChange = (
		originalLevelId: string,
		description: string,
	) => {
		setDescriptions((prev) => ({
			...prev,
			[originalLevelId]: description,
		}))
	}

	const handleReset = () => {
		setMappings(smartMappings)
		setDescriptions(
			Object.fromEntries(
				originalDescriptions.map((desc) => [
					desc.scalingLevelId,
					desc.description || "",
				]),
			),
		)
	}

	const handleSubmit = () => {
		const migrationMappings: DescriptionMapping[] = originalDescriptions
			.map((desc) => {
				const newScalingLevelId = mappings[desc.scalingLevelId]
				if (!newScalingLevelId) return null
				return {
					originalScalingLevelId: desc.scalingLevelId,
					newScalingLevelId,
					description: descriptions[desc.scalingLevelId] || "",
				}
			})
			.filter((mapping): mapping is DescriptionMapping => mapping !== null)

		onMigrate(migrationMappings)
	}

	// Check if all mappings are complete
	const allMappingsComplete = originalDescriptions.every(
		(desc) => mappings[desc.scalingLevelId],
	)

	// Check if migration is possible (we have new scaling levels available)
	const migrationPossible = newScalingLevels.length > 0

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h3 className="text-lg font-semibold">Migrate Scaling Descriptions</h3>
				<p className="text-sm text-muted-foreground">
					{migrationPossible ? (
						<>
							Map the existing scaling descriptions from{" "}
							<span className="font-semibold">"{originalWorkout.name}"</span> to
							the new scaling levels. You can also edit the descriptions during
							migration.
						</>
					) : (
						<>
							No scaling levels are available in the target scaling group. The
							existing scaling descriptions from{" "}
							<span className="font-semibold">"{originalWorkout.name}"</span>{" "}
							cannot be migrated. You can skip migration and add scaling
							descriptions later.
						</>
					)}
				</p>
			</div>

			{migrationPossible ? (
				<div className="space-y-4">
					{originalDescriptions.map((originalDesc) => {
						const selectedNewLevelId = mappings[originalDesc.scalingLevelId]
						const selectedNewLevel = newScalingLevels.find(
							(level) => level.id === selectedNewLevelId,
						)

						return (
							<Card key={originalDesc.id} className="p-4">
								<div className="space-y-4">
									{/* Mapping Header */}
									<div className="flex items-center gap-4">
										<div className="flex-1">
											<Label className="text-sm font-medium">From</Label>
											<div className="flex items-center gap-2 mt-1">
												<Badge variant="outline" className="font-mono">
													Position {originalDesc.scalingLevel.position}
												</Badge>
												<Badge variant="secondary">
													{originalDesc.scalingLevel.label}
												</Badge>
											</div>
										</div>

										<ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

										<div className="flex-1">
											<Label className="text-sm font-medium">To</Label>
											<Select
												value={selectedNewLevelId}
												onValueChange={(value) =>
													handleMappingChange(
														originalDesc.scalingLevelId,
														value,
													)
												}
											>
												<SelectTrigger className="mt-1">
													<SelectValue placeholder="Select scaling level" />
												</SelectTrigger>
												<SelectContent>
													{newScalingLevels.map((level) => (
														<SelectItem key={level.id} value={level.id}>
															<div className="flex items-center gap-2">
																<Badge variant="outline" className="font-mono">
																	Position {level.position}
																</Badge>
																<span>{level.label}</span>
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									{/* Description Editor */}
									<div className="space-y-2">
										<Label className="text-sm font-medium">
											Description
											{selectedNewLevel && (
												<span className="text-muted-foreground font-normal">
													{" "}
													(for {selectedNewLevel.label})
												</span>
											)}
										</Label>
										<Textarea
											value={descriptions[originalDesc.scalingLevelId] || ""}
											onChange={(e) =>
												handleDescriptionChange(
													originalDesc.scalingLevelId,
													e.target.value,
												)
											}
											placeholder="Enter scaling description..."
											className="min-h-[80px] resize-none"
										/>
									</div>
								</div>
							</Card>
						)
					})}
				</div>
			) : (
				<Card className="p-6">
					<div className="text-center space-y-4">
						<div className="text-muted-foreground">
							<p className="font-medium">
								No scaling levels available for migration
							</p>
							<p className="text-sm">
								The target scaling group does not have any scaling levels
								defined. You'll need to add scaling levels to the group before
								migration is possible.
							</p>
						</div>
						<div className="flex flex-col gap-2 text-sm">
							<p className="font-medium">
								Existing descriptions that will be lost:
							</p>
							{originalDescriptions.map((desc) => (
								<div
									key={desc.id}
									className="flex items-center gap-2 justify-center"
								>
									<Badge variant="outline">{desc.scalingLevel.label}</Badge>
									<span className="text-muted-foreground">
										{desc.description
											? `"${desc.description.slice(0, 50)}${desc.description.length > 50 ? "..." : ""}"`
											: "No description"}
									</span>
								</div>
							))}
						</div>
					</div>
				</Card>
			)}

			{/* Actions */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{migrationPossible && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleReset}
							disabled={isLoading}
						>
							<RotateCcw className="h-4 w-4 mr-2" />
							Reset to Smart Mapping
						</Button>
					)}
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={onSkip} disabled={isLoading}>
						Skip Migration
					</Button>
					{migrationPossible && (
						<Button
							onClick={handleSubmit}
							disabled={!allMappingsComplete || isLoading}
						>
							{isLoading ? "Migrating..." : "Migrate Descriptions"}
						</Button>
					)}
				</div>
			</div>

			{/* Validation Message */}
			{migrationPossible && !allMappingsComplete && (
				<div className="text-sm text-destructive">
					Please select a scaling level for all descriptions before migrating.
				</div>
			)}
		</div>
	)
}
