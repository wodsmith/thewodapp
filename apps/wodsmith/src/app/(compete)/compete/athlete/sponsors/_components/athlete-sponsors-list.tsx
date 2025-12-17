"use client"

import { useServerAction } from "@repo/zsa-react"
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
	createSponsorAction,
	deleteSponsorAction,
	updateSponsorAction,
} from "@/actions/sponsors.actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Sponsor } from "@/db/schema"
import { AthleteSponsorFormDialog } from "./athlete-sponsor-form-dialog"

interface AthleteSponsorListProps {
	sponsors: Sponsor[]
	userId: string
}

export function AthleteSponsorsList({
	sponsors: initialSponsors,
	userId,
}: AthleteSponsorListProps) {
	const [sponsors, setSponsors] = useState(initialSponsors)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)

	// Sync state with props
	useEffect(() => {
		setSponsors(initialSponsors)
	}, [initialSponsors])

	// Server actions
	const { execute: createSponsor, isPending: isCreating } =
		useServerAction(createSponsorAction)
	const { execute: updateSponsor } = useServerAction(updateSponsorAction)
	const { execute: deleteSponsor } = useServerAction(deleteSponsorAction)

	const handleCreate = async (data: {
		name: string
		logoUrl?: string
		website?: string
	}) => {
		const [, error] = await createSponsor({
			userId,
			name: data.name,
			logoUrl: data.logoUrl,
			website: data.website,
		})

		if (error) {
			toast.error(error.message || "Failed to add sponsor")
			return
		}

		toast.success("Sponsor added")
		setShowAddDialog(false)
	}

	const handleUpdate = async (
		sponsorId: string,
		data: {
			name?: string
			logoUrl?: string | null
			website?: string | null
		},
	) => {
		const [, error] = await updateSponsor({
			sponsorId,
			...data,
		})

		if (error) {
			toast.error(error.message || "Failed to update sponsor")
			return
		}

		toast.success("Sponsor updated")
		setEditingSponsor(null)
	}

	const handleDelete = async (sponsorId: string) => {
		const [, error] = await deleteSponsor({ sponsorId })

		if (error) {
			toast.error(error.message || "Failed to remove sponsor")
			return
		}

		toast.success("Sponsor removed")
	}

	return (
		<div className="space-y-6">
			{/* Add button */}
			<div className="flex justify-end">
				<Button onClick={() => setShowAddDialog(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Add Sponsor
				</Button>
			</div>

			{/* Sponsors grid */}
			{sponsors.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<p className="text-muted-foreground mb-4">No sponsors yet</p>
						<p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
							Add your sponsors and partners to showcase them on your athlete
							profile.
						</p>
						<Button onClick={() => setShowAddDialog(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add Your First Sponsor
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{sponsors.map((sponsor) => (
						<Card key={sponsor.id} className="group relative">
							<CardContent className="p-4">
								<div className="flex flex-col items-center text-center gap-3">
									{sponsor.logoUrl ? (
										<div className="relative h-20 w-full">
											<Image
												src={sponsor.logoUrl}
												alt={sponsor.name}
												fill
												className="object-contain"
											/>
										</div>
									) : (
										<div className="h-20 flex items-center justify-center">
											<p className="text-lg font-semibold">{sponsor.name}</p>
										</div>
									)}

									{sponsor.logoUrl && (
										<p className="font-medium text-sm">{sponsor.name}</p>
									)}

									{sponsor.website && (
										<Button
											asChild
											variant="link"
											size="sm"
											className="h-auto p-0"
										>
											<Link
												href={sponsor.website}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs flex items-center gap-1"
											>
												<ExternalLink className="h-3 w-3" />
												Website
											</Link>
										</Button>
									)}
								</div>

								{/* Actions (show on hover) */}
								<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => setEditingSponsor(sponsor)}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive hover:text-destructive"
										onClick={() => handleDelete(sponsor.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Dialogs */}
			<AthleteSponsorFormDialog
				open={showAddDialog}
				onOpenChange={setShowAddDialog}
				onSubmit={handleCreate}
				isPending={isCreating}
			/>

			<AthleteSponsorFormDialog
				open={!!editingSponsor}
				onOpenChange={(open) => !open && setEditingSponsor(null)}
				sponsor={editingSponsor ?? undefined}
				onSubmit={(data) => {
					if (editingSponsor) {
						return handleUpdate(editingSponsor.id, data)
					}
				}}
			/>
		</div>
	)
}
