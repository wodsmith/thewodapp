"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CompetitionVenue } from "@/db/schema"
import {
	createVenueAction,
	deleteVenueAction,
	updateVenueAction,
} from "@/actions/competition-heat-actions"

interface VenueManagerProps {
	competitionId: string
	organizingTeamId: string
	venues: CompetitionVenue[]
}

export function VenueManager({
	competitionId,
	organizingTeamId,
	venues: initialVenues,
}: VenueManagerProps) {
	const [venues, setVenues] = useState(initialVenues)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingVenue, setEditingVenue] = useState<CompetitionVenue | null>(
		null,
	)
	const [newVenueName, setNewVenueName] = useState("")
	const [newLaneCount, setNewLaneCount] = useState(3)
	const [newTransitionMinutes, setNewTransitionMinutes] = useState(3)

	const createVenue = useServerAction(createVenueAction)
	const updateVenue = useServerAction(updateVenueAction)
	const deleteVenue = useServerAction(deleteVenueAction)

	async function handleCreate() {
		if (!newVenueName.trim()) return

		const [result, _error] = await createVenue.execute({
			competitionId,
			organizingTeamId,
			name: newVenueName.trim(),
			laneCount: newLaneCount,
			transitionMinutes: newTransitionMinutes,
		})

		if (result?.data) {
			setVenues([...venues, result.data])
			setNewVenueName("")
			setNewLaneCount(10)
			setNewTransitionMinutes(10)
			setIsCreateOpen(false)
		}
	}

	async function handleUpdate() {
		if (!editingVenue || !editingVenue.name.trim()) return

		const [, error] = await updateVenue.execute({
			id: editingVenue.id,
			organizingTeamId,
			name: editingVenue.name.trim(),
			laneCount: editingVenue.laneCount,
			transitionMinutes: editingVenue.transitionMinutes,
		})

		if (!error) {
			setVenues(
				venues.map((v) => (v.id === editingVenue.id ? editingVenue : v)),
			)
			setEditingVenue(null)
		}
	}

	async function handleDelete(venue: CompetitionVenue) {
		if (
			!confirm(
				`Delete venue "${venue.name}"? This will unassign all heats from this venue.`,
			)
		) {
			return
		}

		const [, error] = await deleteVenue.execute({
			id: venue.id,
			organizingTeamId,
		})

		if (!error) {
			setVenues(venues.filter((v) => v.id !== venue.id))
		}
	}

	return (
		<div className="space-y-4">
			{/* Venue List */}
			{venues.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="py-8 text-center text-muted-foreground">
						<p className="mb-4">No venues created yet.</p>
						<p className="text-sm">
							Create venues like "Main Floor" or "Outside Rig" to assign heats
							to specific locations.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{venues.map((venue) => (
						<Card key={venue.id}>
							<CardContent className="py-4">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="font-medium">{venue.name}</h3>
										<p className="text-sm text-muted-foreground">
											{venue.laneCount} lanes • {venue.transitionMinutes}min
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => setEditingVenue(venue)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleDelete(venue)}
											disabled={deleteVenue.isPending}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Create Venue Dialog */}
			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" size="sm">
						<Plus className="h-4 w-4 mr-2" />
						Add Venue
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Venue</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="venue-name">Name</Label>
							<Input
								id="venue-name"
								value={newVenueName}
								onChange={(e) => setNewVenueName(e.target.value)}
								placeholder="Main Floor"
							/>
						</div>
						<div>
							<Label htmlFor="lane-count">Number of Lanes</Label>
							<Input
								id="lane-count"
								type="number"
								min={1}
								max={100}
								value={newLaneCount}
								onChange={(e) => setNewLaneCount(Number(e.target.value))}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Maximum athletes per heat at this venue
							</p>
						</div>
						<div>
							<Label htmlFor="transition-minutes">
								Transition Time (minutes)
							</Label>
							<Input
								id="transition-minutes"
								type="number"
								min={1}
								max={120}
								value={newTransitionMinutes}
								onChange={(e) =>
									setNewTransitionMinutes(Number(e.target.value))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Time between heats for setup/teardown
							</p>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setIsCreateOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleCreate} disabled={createVenue.isPending}>
								{createVenue.isPending && (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								)}
								Create
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Venue Dialog */}
			<Dialog
				open={!!editingVenue}
				onOpenChange={(open) => !open && setEditingVenue(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Venue</DialogTitle>
					</DialogHeader>
					{editingVenue && (
						<div className="space-y-4">
							<div>
								<Label htmlFor="edit-venue-name">Name</Label>
								<Input
									id="edit-venue-name"
									value={editingVenue.name}
									onChange={(e) =>
										setEditingVenue({ ...editingVenue, name: e.target.value })
									}
								/>
							</div>
							<div>
								<Label htmlFor="edit-lane-count">Number of Lanes</Label>
								<Input
									id="edit-lane-count"
									type="number"
									min={1}
									max={100}
									value={editingVenue.laneCount}
									onChange={(e) =>
										setEditingVenue({
											...editingVenue,
											laneCount: Number(e.target.value),
										})
									}
								/>
							</div>
							<div>
								<Label htmlFor="edit-transition-minutes">
									Transition Time (minutes)
								</Label>
								<Input
									id="edit-transition-minutes"
									type="number"
									min={1}
									max={120}
									value={editingVenue.transitionMinutes}
									onChange={(e) =>
										setEditingVenue({
											...editingVenue,
											transitionMinutes: Number(e.target.value),
										})
									}
								/>
							</div>
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setEditingVenue(null)}>
									Cancel
								</Button>
								<Button onClick={handleUpdate} disabled={updateVenue.isPending}>
									{updateVenue.isPending && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									Save
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	)
}
