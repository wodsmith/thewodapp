"use client"

import { useServerFn } from "@tanstack/react-start"
import { FileText, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { EventResourceDialog } from "@/components/events/event-resource-dialog"
import { EventResourceRow } from "@/components/events/event-resource-row"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { EventResource } from "@/db/schemas/event-resources"
import {
	createEventResourceFn,
	deleteEventResourceFn,
	reorderEventResourcesFn,
	updateEventResourceFn,
} from "@/server-fns/event-resources-fns"

interface EventResourcesCardProps {
	eventId: string
	teamId: string
	initialResources: EventResource[]
}

export function EventResourcesCard({
	eventId,
	teamId,
	initialResources,
}: EventResourcesCardProps) {
	const [resources, setResources] = useState<EventResource[]>(initialResources)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [editingResource, setEditingResource] = useState<EventResource | null>(
		null,
	)
	const [isSaving, setIsSaving] = useState(false)

	// Server functions
	const createResource = useServerFn(createEventResourceFn)
	const updateResource = useServerFn(updateEventResourceFn)
	const deleteResource = useServerFn(deleteEventResourceFn)
	const reorderResources = useServerFn(reorderEventResourcesFn)

	// Unique instance ID for drag-and-drop
	const instanceId = useMemo(() => Symbol("event-resources"), [])

	// Sync with initial resources when they change
	useEffect(() => {
		setResources(initialResources)
	}, [initialResources])

	// Handle drag-and-drop reorder
	const handleDrop = useCallback(
		async (sourceIndex: number, targetIndex: number) => {
			if (sourceIndex === targetIndex) return

			// Optimistic update
			const newResources = [...resources]
			const [movedItem] = newResources.splice(sourceIndex, 1)
			newResources.splice(targetIndex, 0, movedItem)

			// Update sort orders
			const updatedResources = newResources.map((resource, index) => ({
				...resource,
				sortOrder: index + 1,
			}))

			setResources(updatedResources)

			// Persist to server
			try {
				await reorderResources({
					data: {
						eventId,
						teamId,
						updates: updatedResources.map((r) => ({
							resourceId: r.id,
							sortOrder: r.sortOrder,
						})),
					},
				})
			} catch (error) {
				// Revert on error
				setResources(resources)
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to reorder resources",
				)
			}
		},
		[resources, eventId, teamId, reorderResources],
	)

	// Handle add/edit dialog
	const handleOpenAddDialog = () => {
		setEditingResource(null)
		setIsDialogOpen(true)
	}

	const handleOpenEditDialog = (resource: EventResource) => {
		setEditingResource(resource)
		setIsDialogOpen(true)
	}

	const handleSaveResource = async (data: {
		title: string
		description?: string
		url?: string
	}) => {
		setIsSaving(true)

		try {
			if (editingResource) {
				// Update existing resource
				const result = await updateResource({
					data: {
						resourceId: editingResource.id,
						teamId,
						title: data.title,
						description: data.description || null,
						url: data.url || null,
					},
				})

				if (result.resource) {
					setResources((prev) =>
						prev.map((r) =>
							// biome-ignore lint/style/noNonNullAssertion: if check guarantees resource exists
							r.id === editingResource.id ? result.resource! : r,
						),
					)
					toast.success("Resource updated")
				}
			} else {
				// Create new resource
				const result = await createResource({
					data: {
						eventId,
						teamId,
						title: data.title,
						description: data.description,
						url: data.url,
					},
				})

				if (result.resource) {
					setResources((prev) => [...prev, result.resource])
					toast.success("Resource added")
				}
			}

			setIsDialogOpen(false)
			setEditingResource(null)
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to save resource",
			)
		} finally {
			setIsSaving(false)
		}
	}

	const handleDeleteResource = async (resourceId: string) => {
		// Optimistic delete
		const previousResources = resources
		setResources((prev) => prev.filter((r) => r.id !== resourceId))

		try {
			await deleteResource({
				data: {
					resourceId,
					teamId,
				},
			})
			toast.success("Resource deleted")
		} catch (error) {
			// Revert on error
			setResources(previousResources)
			toast.error(
				error instanceof Error ? error.message : "Failed to delete resource",
			)
		}
	}

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								Event Resources
							</CardTitle>
							<CardDescription className="mt-1">
								Attach videos, documents, or instructions to this event
							</CardDescription>
						</div>
						<Button size="sm" onClick={handleOpenAddDialog}>
							<Plus className="h-4 w-4 mr-1" />
							Add Resource
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{resources.length === 0 ? (
						<div className="text-center py-8">
							<FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
							<p className="mt-2 text-sm text-muted-foreground">
								No resources added yet
							</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-4"
								onClick={handleOpenAddDialog}
							>
								<Plus className="h-4 w-4 mr-1" />
								Add your first resource
							</Button>
						</div>
					) : (
						<div className="space-y-2">
							{resources
								.sort((a, b) => a.sortOrder - b.sortOrder)
								.map((resource, index) => (
									<EventResourceRow
										key={resource.id}
										resource={resource}
										index={index}
										instanceId={instanceId}
										onEdit={() => handleOpenEditDialog(resource)}
										onDelete={() => handleDeleteResource(resource.id)}
										onDrop={handleDrop}
									/>
								))}
						</div>
					)}
				</CardContent>
			</Card>

			<EventResourceDialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					setIsDialogOpen(open)
					if (!open) setEditingResource(null)
				}}
				resource={editingResource}
				onSave={handleSaveResource}
				isSaving={isSaving}
			/>
		</>
	)
}
