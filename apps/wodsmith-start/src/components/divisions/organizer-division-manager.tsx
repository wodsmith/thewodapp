"use client"

import { useRouter } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
	addCompetitionDivisionFn,
	deleteCompetitionDivisionFn,
	reorderCompetitionDivisionsFn,
	updateCompetitionDivisionFn,
	updateDivisionDescriptionFn,
} from "@/server-fns/competition-divisions-fns"
import { OrganizerDivisionItem } from "./organizer-division-item"
import { OrganizerTemplateSelector } from "./organizer-template-selector"

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
	description: string | null
	feeCents: number | null
}

interface ScalingGroupWithLevels {
	id: string
	title: string
	description: string | null
	teamId?: string | null
	isSystem: number
	levels: Array<{
		id: string
		label: string
		position: number
	}>
}

interface OrganizerDivisionManagerProps {
	teamId: string
	competitionId: string
	divisions: Division[]
	scalingGroupId: string | null
	scalingGroups: ScalingGroupWithLevels[]
}

export function OrganizerDivisionManager({
	teamId,
	competitionId,
	divisions: initialDivisions,
	scalingGroupId,
	scalingGroups,
}: OrganizerDivisionManagerProps) {
	const router = useRouter()
	const [divisions, setDivisions] = useState(initialDivisions)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [newDivisionLabel, setNewDivisionLabel] = useState("")
	const [newDivisionTeamSize, setNewDivisionTeamSize] = useState(1)
	const [newDivisionDescription, setNewDivisionDescription] = useState("")
	const [instanceId] = useState(() => Symbol("divisions"))
	const [isAdding, setIsAdding] = useState(false)

	// Sync props to state when server data changes (e.g., after router.invalidate())
	useEffect(() => {
		setDivisions(initialDivisions)
	}, [initialDivisions])

	// If no divisions configured, show template selector
	if (!scalingGroupId || divisions.length === 0) {
		return (
			<OrganizerTemplateSelector
				teamId={teamId}
				competitionId={competitionId}
				scalingGroups={scalingGroups}
				onSuccess={() => router.invalidate()}
			/>
		)
	}

	const handleLabelSave = async (divisionId: string, newLabel: string) => {
		const original = initialDivisions.find((d) => d.id === divisionId)
		if (original && original.label === newLabel) return

		// Optimistically update
		setDivisions((prev) =>
			prev.map((d) => (d.id === divisionId ? { ...d, label: newLabel } : d)),
		)

		try {
			await updateCompetitionDivisionFn({
				data: {
					teamId,
					competitionId,
					divisionId,
					label: newLabel,
				},
			})
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update division",
			)
			// Revert to original
			setDivisions((prev) =>
				prev.map((d) =>
					d.id === divisionId
						? { ...d, label: original?.label ?? newLabel }
						: d,
				),
			)
		}
	}

	const handleDescriptionSave = async (
		divisionId: string,
		newDescription: string | null,
	) => {
		const original = initialDivisions.find((d) => d.id === divisionId)
		if (original && original.description === newDescription) return

		// Optimistically update
		setDivisions((prev) =>
			prev.map((d) =>
				d.id === divisionId ? { ...d, description: newDescription } : d,
			),
		)

		try {
			await updateDivisionDescriptionFn({
				data: {
					teamId,
					competitionId,
					divisionId,
					description: newDescription,
				},
			})
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update description",
			)
			// Revert to original
			setDivisions((prev) =>
				prev.map((d) =>
					d.id === divisionId
						? { ...d, description: original?.description ?? newDescription }
						: d,
				),
			)
		}
	}

	const handleRemove = async (divisionId: string) => {
		try {
			await deleteCompetitionDivisionFn({
				data: {
					teamId,
					competitionId,
					divisionId,
				},
			})
			toast.success("Division deleted")
			setDivisions((prev) => prev.filter((d) => d.id !== divisionId))
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete division",
			)
		}
	}

	const handleDrop = async (sourceIndex: number, targetIndex: number) => {
		const newDivisions = [...divisions]
		const [movedItem] = newDivisions.splice(sourceIndex, 1)
		if (movedItem) {
			newDivisions.splice(targetIndex, 0, movedItem)

			// Update positions
			const updatedDivisions = newDivisions.map((div, index) => ({
				...div,
				position: index,
			}))

			setDivisions(updatedDivisions)

			// Persist to server
			try {
				await reorderCompetitionDivisionsFn({
					data: {
						teamId,
						competitionId,
						orderedDivisionIds: updatedDivisions.map((d) => d.id),
					},
				})
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to reorder divisions",
				)
				// Revert
				setDivisions(initialDivisions)
			}
		}
	}

	const handleAddDivision = async () => {
		if (!newDivisionLabel.trim()) return

		setIsAdding(true)
		try {
			const result = await addCompetitionDivisionFn({
				data: {
					teamId,
					competitionId,
					label: newDivisionLabel.trim(),
					teamSize: newDivisionTeamSize,
				},
			})

			// If description was provided, update it
			const descriptionToSave = newDivisionDescription.trim() || null
			if (descriptionToSave && result?.divisionId) {
				await updateDivisionDescriptionFn({
					data: {
						teamId,
						competitionId,
						divisionId: result.divisionId,
						description: descriptionToSave,
					},
				})
			}

			toast.success("Division added")
			// Don't optimistically update - let useEffect sync from server via revalidation
			// to avoid duplicate entries when server action revalidates the page
			setNewDivisionLabel("")
			setNewDivisionTeamSize(1)
			setNewDivisionDescription("")
			setShowAddDialog(false)
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to add division",
			)
		} finally {
			setIsAdding(false)
		}
	}

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Competition Divisions</CardTitle>
							<CardDescription>
								Drag to reorder. Athletes will select a division when
								registering.
							</CardDescription>
						</div>
						<Button onClick={() => setShowAddDialog(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Division
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{divisions
							.sort((a, b) => a.position - b.position)
							.map((division, index) => (
								<OrganizerDivisionItem
									key={division.id}
									id={division.id}
									label={division.label}
									description={division.description}
									index={index}
									registrationCount={division.registrationCount}
									isOnly={divisions.length === 1}
									instanceId={instanceId}
									onLabelSave={(label) => handleLabelSave(division.id, label)}
									onDescriptionSave={(desc) =>
										handleDescriptionSave(division.id, desc)
									}
									onRemove={() => handleRemove(division.id)}
									onDrop={handleDrop}
								/>
							))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>How Divisions Work</CardTitle>
					<CardDescription>Understanding competition divisions</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p>
						Athletes will select their division when registering for this
						competition.
					</p>
					<p>
						The order determines display priority - first division appears first
						in selection dropdowns.
					</p>
					<p>
						Divisions with registered athletes cannot be deleted. You can still
						rename them.
					</p>
				</CardContent>
			</Card>

			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Division</DialogTitle>
						<DialogDescription>
							Create a new division for athletes to register in.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<Label htmlFor="divisionName">Division Name</Label>
							<Input
								id="divisionName"
								value={newDivisionLabel}
								onChange={(e) => setNewDivisionLabel(e.target.value)}
								placeholder="e.g., Masters 40+, Teen 14-17, RX"
								className="mt-2"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										handleAddDivision()
									}
								}}
							/>
						</div>
						<div>
							<Label htmlFor="teamSize">Team Size</Label>
							<Input
								id="teamSize"
								type="number"
								min={1}
								max={10}
								value={newDivisionTeamSize}
								onChange={(e) => setNewDivisionTeamSize(Number(e.target.value))}
								className="mt-2"
							/>
							<p className="text-muted-foreground text-sm mt-1">
								1 = Individual, 2+ = Team division
							</p>
						</div>
						<div>
							<Label htmlFor="description">Description (Optional)</Label>
							<Textarea
								id="description"
								value={newDivisionDescription}
								onChange={(e) => setNewDivisionDescription(e.target.value)}
								placeholder="Describe who this division is for (e.g., athletes who can perform movements as prescribed)"
								className="mt-2"
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAddDialog(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleAddDivision}
							disabled={isAdding || !newDivisionLabel.trim()}
						>
							{isAdding ? "Adding..." : "Add Division"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
