"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	addCompetitionDivisionAction,
	deleteCompetitionDivisionAction,
	reorderCompetitionDivisionsAction,
	updateCompetitionDivisionAction,
} from "@/actions/competition-division-actions"
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
import { DivisionItem } from "./division-item"
import { TemplateSelector } from "./template-selector"

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
}

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

interface DivisionManagerProps {
	teamId: string
	competitionId: string
	divisions: Division[]
	scalingGroupId: string | null
	scalingGroups: ScalingGroupWithLevels[]
}

export function DivisionManager({
	teamId,
	competitionId,
	divisions: initialDivisions,
	scalingGroupId,
	scalingGroups,
}: DivisionManagerProps) {
	const router = useRouter()
	const [divisions, setDivisions] = useState(initialDivisions)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [newDivisionLabel, setNewDivisionLabel] = useState("")
	const [instanceId] = useState(() => Symbol("divisions"))

	// Sync props to state when server data changes (e.g., after router.refresh())
	useEffect(() => {
		setDivisions(initialDivisions)
	}, [initialDivisions])

	const { execute: addDivision, isPending: isAdding } = useServerAction(
		addCompetitionDivisionAction,
	)

	const { execute: updateDivision } = useServerAction(
		updateCompetitionDivisionAction,
	)

	const { execute: deleteDivision } = useServerAction(
		deleteCompetitionDivisionAction,
	)

	const { execute: reorderDivisions } = useServerAction(
		reorderCompetitionDivisionsAction,
	)

	// If no divisions configured, show template selector
	if (!scalingGroupId || divisions.length === 0) {
		return (
			<TemplateSelector
				teamId={teamId}
				competitionId={competitionId}
				scalingGroups={scalingGroups}
				onSuccess={() => router.refresh()}
			/>
		)
	}

	const handleLabelChange = (divisionId: string, newLabel: string) => {
		setDivisions((prev) =>
			prev.map((d) => (d.id === divisionId ? { ...d, label: newLabel } : d)),
		)
	}

	const handleLabelBlur = async (divisionId: string, label: string) => {
		const original = initialDivisions.find((d) => d.id === divisionId)
		if (original && original.label === label) return

		const [_result, error] = await updateDivision({
			teamId,
			competitionId,
			divisionId,
			label,
		})

		if (error) {
			toast.error(error.message || "Failed to update division")
			// Revert to original
			setDivisions((prev) =>
				prev.map((d) =>
					d.id === divisionId ? { ...d, label: original?.label ?? label } : d,
				),
			)
		}
	}

	const handleRemove = async (divisionId: string) => {
		const [_result, error] = await deleteDivision({
			teamId,
			competitionId,
			divisionId,
		})

		if (error) {
			toast.error(error.message || "Failed to delete division")
		} else {
			toast.success("Division deleted")
			setDivisions((prev) => prev.filter((d) => d.id !== divisionId))
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
			const [_result, error] = await reorderDivisions({
				teamId,
				competitionId,
				orderedDivisionIds: updatedDivisions.map((d) => d.id),
			})

			if (error) {
				toast.error(error.message || "Failed to reorder divisions")
				// Revert
				setDivisions(initialDivisions)
			}
		}
	}

	const handleAddDivision = async () => {
		if (!newDivisionLabel.trim()) return

		const [result, error] = await addDivision({
			teamId,
			competitionId,
			label: newDivisionLabel.trim(),
		})

		if (error) {
			toast.error(error.message || "Failed to add division")
		} else if (result?.data) {
			toast.success("Division added")
			setDivisions((prev) => [
				...prev,
				{
					id: result.data.divisionId,
					label: newDivisionLabel.trim(),
					position: prev.length,
					registrationCount: 0,
				},
			])
			setNewDivisionLabel("")
			setShowAddDialog(false)
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
								<DivisionItem
									key={division.id}
									id={division.id}
									label={division.label}
									index={index}
									registrationCount={division.registrationCount}
									isOnly={divisions.length === 1}
									instanceId={instanceId}
									onLabelChange={(label) =>
										handleLabelChange(division.id, label)
									}
									onLabelBlur={() =>
										handleLabelBlur(division.id, division.label)
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
					<div className="py-4">
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
