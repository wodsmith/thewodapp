"use client"

import { useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import { Loader2, Plus, Trash2 } from "lucide-react"
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
	DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CompetitionFloor } from "@/db/schema"
import {
	createCompetitionFloorAction,
	deleteCompetitionFloorAction,
	updateCompetitionFloorAction,
} from "@/actions/competition-schedule-actions"

interface FloorManagerProps {
	competitionId: string
	floors: CompetitionFloor[]
}

export function FloorManager({ competitionId, floors }: FloorManagerProps) {
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
	const [newFloorName, setNewFloorName] = useState("")
	const [newFloorCapacity, setNewFloorCapacity] = useState(10)

	const createFloor = useServerAction(createCompetitionFloorAction)
	const updateFloor = useServerAction(updateCompetitionFloorAction)
	const deleteFloor = useServerAction(deleteCompetitionFloorAction)

	const handleAddFloor = async () => {
		if (!newFloorName.trim()) return

		await createFloor.execute({
			competitionId,
			name: newFloorName.trim(),
			capacity: newFloorCapacity,
		})

		setNewFloorName("")
		setNewFloorCapacity(10)
		setIsAddDialogOpen(false)
	}

	const handleDeleteFloor = async (floorId: string) => {
		if (!confirm("Are you sure you want to delete this floor? All heats on this floor will also be deleted.")) {
			return
		}

		await deleteFloor.execute({
			competitionId,
			floorId,
		})
	}

	const handleUpdateCapacity = async (floorId: string, capacity: number) => {
		await updateFloor.execute({
			competitionId,
			floorId,
			capacity,
		})
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Floors / Lanes</CardTitle>
					<CardDescription>
						Configure the physical spaces where heats will run
					</CardDescription>
				</div>
				<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<Plus className="h-4 w-4 mr-2" />
							Add Floor
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add Floor</DialogTitle>
							<DialogDescription>
								Create a new floor or lane area for heats
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									placeholder="e.g., Floor A, Lanes 1-10"
									value={newFloorName}
									onChange={(e) => setNewFloorName(e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="capacity">Capacity (athletes per heat)</Label>
								<Input
									id="capacity"
									type="number"
									min={1}
									max={100}
									value={newFloorCapacity}
									onChange={(e) => setNewFloorCapacity(Number(e.target.value))}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setIsAddDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleAddFloor}
								disabled={!newFloorName.trim() || createFloor.isPending}
							>
								{createFloor.isPending && (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								)}
								Add Floor
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardHeader>
			<CardContent>
				{floors.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						<p>No floors configured yet.</p>
						<p className="text-sm mt-1">
							Add at least one floor to start creating heat schedules.
						</p>
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{floors.map((floor) => (
							<div
								key={floor.id}
								className="flex items-center justify-between p-4 border rounded-lg"
							>
								<div>
									<div className="font-medium">{floor.name}</div>
									<div className="text-sm text-muted-foreground">
										Capacity: {floor.capacity} athletes
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Input
										type="number"
										min={1}
										max={100}
										value={floor.capacity}
										onChange={(e) =>
											handleUpdateCapacity(floor.id, Number(e.target.value))
										}
										className="w-20"
									/>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDeleteFloor(floor.id)}
										disabled={deleteFloor.isPending}
									>
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
