"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AddressFields } from "@/components/forms/address-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { CompetitionVenue } from "@/db/schemas/competitions"
import { createAddressFn } from "@/server-fns/address-fns"
import {
	createVenueFn,
	deleteVenueFn,
	getVenueHeatCountFn,
	updateVenueFn,
} from "@/server-fns/competition-heats-fns"
import { formatCityLine } from "@/utils/address"

interface VenueWithAddress extends CompetitionVenue {
	address?: {
		id: string
		name: string | null
		streetLine1: string | null
		streetLine2: string | null
		city: string | null
		stateProvince: string | null
		postalCode: string | null
		countryCode: string | null
		notes: string | null
	} | null
}

interface VenueManagerProps {
	competitionId: string
	venues: VenueWithAddress[]
	onVenueUpdate?: (venue: VenueWithAddress) => void
	onVenueCreate?: (venue: VenueWithAddress) => void
	onVenueDelete?: (venueId: string) => void
	primaryAddressId?: string | null
	primaryAddress?: {
		name: string | null
		streetLine1: string | null
		city: string | null
		stateProvince: string | null
	} | null
}

const venueFormSchema = z.object({
	name: z.string().min(1, "Venue name is required").max(100),
	laneCount: z.number().int().min(1).max(100),
	transitionMinutes: z.number().int().min(0).max(120),
	usePrimaryAddress: z.boolean(),
	address: z
		.object({
			name: z.string().optional(),
			streetLine1: z.string().optional(),
			streetLine2: z.string().optional(),
			city: z.string().optional(),
			stateProvince: z.string().optional(),
			postalCode: z.string().optional(),
			countryCode: z.string().optional(),
			notes: z.string().optional(),
		})
		.optional(),
})

type VenueFormValues = z.infer<typeof venueFormSchema>

const defaultFormValues: VenueFormValues = {
	name: "",
	laneCount: 3,
	transitionMinutes: 3,
	usePrimaryAddress: false,
	address: {
		name: "",
		streetLine1: "",
		streetLine2: "",
		city: "",
		stateProvince: "",
		postalCode: "",
		countryCode: "US",
		notes: "",
	},
}

export function VenueManager({
	competitionId,
	venues,
	onVenueUpdate,
	onVenueCreate,
	onVenueDelete,
	primaryAddressId,
	primaryAddress,
}: VenueManagerProps) {
	const [internalVenues, setInternalVenues] = useState(venues)
	const displayVenues = onVenueUpdate ? venues : internalVenues
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingVenue, setEditingVenue] = useState<VenueWithAddress | null>(
		null,
	)
	const [isCreating, setIsCreating] = useState(false)
	const [isUpdating, setIsUpdating] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)

	const createForm = useForm<VenueFormValues>({
		resolver: standardSchemaResolver(venueFormSchema),
		defaultValues: {
			...defaultFormValues,
			usePrimaryAddress: !!primaryAddressId,
		},
	})

	const editForm = useForm<VenueFormValues>({
		resolver: standardSchemaResolver(venueFormSchema),
		defaultValues: defaultFormValues,
	})

	const usePrimaryAddressCreate = createForm.watch("usePrimaryAddress")
	const usePrimaryAddressEdit = editForm.watch("usePrimaryAddress")

	async function handleCreate(data: VenueFormValues) {
		setIsCreating(true)
		try {
			let addressId: string | undefined

			if (data.usePrimaryAddress && primaryAddressId) {
				addressId = primaryAddressId
			} else if (
				data.address?.city?.trim() ||
				data.address?.streetLine1?.trim()
			) {
				const newAddress = await createAddressFn({
					data: {
						name: data.address.name?.trim() || undefined,
						streetLine1: data.address.streetLine1?.trim() || undefined,
						streetLine2: data.address.streetLine2?.trim() || undefined,
						city: data.address.city?.trim() || undefined,
						stateProvince: data.address.stateProvince?.trim() || undefined,
						postalCode: data.address.postalCode?.trim() || undefined,
						countryCode: data.address.countryCode?.trim() || "US",
						notes: data.address.notes?.trim() || undefined,
						addressType: "venue",
					},
				})
				addressId = newAddress.id
			}

			const result = await createVenueFn({
				data: {
					competitionId,
					name: data.name.trim(),
					laneCount: data.laneCount,
					transitionMinutes: data.transitionMinutes,
					addressId,
				},
			})

			const newVenue = result.venue

			if (onVenueCreate) {
				onVenueCreate(newVenue)
			} else {
				setInternalVenues([...internalVenues, newVenue])
			}

			toast.success("Venue created")
			createForm.reset({
				...defaultFormValues,
				usePrimaryAddress: !!primaryAddressId,
			})
			setIsCreateOpen(false)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create venue"
			toast.error(message)
		} finally {
			setIsCreating(false)
		}
	}

	async function handleUpdate(data: VenueFormValues) {
		if (!editingVenue) return

		setIsUpdating(true)
		try {
			let addressId: string | undefined

			if (data.usePrimaryAddress && primaryAddressId) {
				addressId = primaryAddressId
			} else if (
				data.address?.city?.trim() ||
				data.address?.streetLine1?.trim()
			) {
				const newAddress = await createAddressFn({
					data: {
						name: data.address.name?.trim() || undefined,
						streetLine1: data.address.streetLine1?.trim() || undefined,
						streetLine2: data.address.streetLine2?.trim() || undefined,
						city: data.address.city?.trim() || undefined,
						stateProvince: data.address.stateProvince?.trim() || undefined,
						postalCode: data.address.postalCode?.trim() || undefined,
						countryCode: data.address.countryCode?.trim() || "US",
						notes: data.address.notes?.trim() || undefined,
						addressType: "venue",
					},
				})
				addressId = newAddress.id
			}

			await updateVenueFn({
				data: {
					venueId: editingVenue.id,
					name: data.name.trim(),
					laneCount: data.laneCount,
					transitionMinutes: data.transitionMinutes,
					addressId,
				},
			})

			if (onVenueUpdate) {
				onVenueUpdate({
					...editingVenue,
					name: data.name,
					laneCount: data.laneCount,
					transitionMinutes: data.transitionMinutes,
				})
			} else {
				setInternalVenues(
					internalVenues.map((v) =>
						v.id === editingVenue.id
							? {
									...v,
									name: data.name,
									laneCount: data.laneCount,
									transitionMinutes: data.transitionMinutes,
								}
							: v,
					),
				)
			}

			toast.success("Venue updated")
			setEditingVenue(null)
			editForm.reset(defaultFormValues)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update venue"
			toast.error(message)
		} finally {
			setIsUpdating(false)
		}
	}

	async function handleDelete(venue: CompetitionVenue) {
		setIsDeleting(true)
		try {
			const { count } = await getVenueHeatCountFn({
				data: { venueId: venue.id },
			})

			const confirmMessage =
				count > 0
					? `Delete venue "${venue.name}"? ${count} heat(s) are assigned to this venue and will be unassigned.`
					: `Delete venue "${venue.name}"?`

			if (!confirm(confirmMessage)) {
				setIsDeleting(false)
				return
			}

			await deleteVenueFn({
				data: { venueId: venue.id },
			})

			if (onVenueDelete) {
				onVenueDelete(venue.id)
			} else {
				setInternalVenues(internalVenues.filter((v) => v.id !== venue.id))
			}

			toast.success("Venue deleted")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete venue"
			toast.error(message)
		} finally {
			setIsDeleting(false)
		}
	}

	function openEditDialog(venue: VenueWithAddress) {
		setEditingVenue(venue)
		const usesPrimary =
			venue.addressId === primaryAddressId && !!primaryAddressId
		editForm.reset({
			name: venue.name,
			laneCount: venue.laneCount,
			transitionMinutes: venue.transitionMinutes,
			usePrimaryAddress: usesPrimary,
			address: usesPrimary
				? defaultFormValues.address
				: {
						name: venue.address?.name ?? "",
						streetLine1: venue.address?.streetLine1 ?? "",
						streetLine2: venue.address?.streetLine2 ?? "",
						city: venue.address?.city ?? "",
						stateProvince: venue.address?.stateProvince ?? "",
						postalCode: venue.address?.postalCode ?? "",
						countryCode: venue.address?.countryCode ?? "US",
						notes: venue.address?.notes ?? "",
					},
		})
	}

	return (
		<div className="space-y-4">
			{/* Venue List */}
			{displayVenues.length === 0 ? (
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
					{displayVenues.map((venue) => (
						<Card key={venue.id}>
							<CardContent className="py-4">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="font-medium">{venue.name}</h3>
										<p className="text-sm text-muted-foreground">
											{venue.laneCount} lanes • {venue.transitionMinutes}min
										</p>
										{venue.address && (
											<p className="text-xs text-muted-foreground">
												{venue.address.name ||
													formatCityLine(venue.address) ||
													"Address set"}
											</p>
										)}
									</div>
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => openEditDialog(venue)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleDelete(venue)}
											disabled={isDeleting}
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
			<Dialog
				open={isCreateOpen}
				onOpenChange={(open) => {
					setIsCreateOpen(open)
					if (!open) {
						createForm.reset({
							...defaultFormValues,
							usePrimaryAddress: !!primaryAddressId,
						})
					}
				}}
			>
				<DialogTrigger asChild>
					<Button variant="outline" size="sm">
						<Plus className="h-4 w-4 mr-2" />
						Add Venue
					</Button>
				</DialogTrigger>
				<DialogContent className="max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Create Venue</DialogTitle>
					</DialogHeader>
					<Form {...createForm}>
						<form
							onSubmit={createForm.handleSubmit(handleCreate)}
							className="space-y-4"
						>
							<FormField
								control={createForm.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Venue Name</FormLabel>
										<FormControl>
											<Input placeholder="Main Floor" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={createForm.control}
									name="laneCount"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Number of Lanes</FormLabel>
											<FormControl>
												<Input
													type="number"
													min={1}
													max={100}
													value={field.value}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<FormDescription>Max athletes per heat</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={createForm.control}
									name="transitionMinutes"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Transition Time (min)</FormLabel>
											<FormControl>
												<Input
													type="number"
													min={0}
													max={120}
													value={field.value}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<FormDescription>Time between heats</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{/* Primary Address Option */}
							{primaryAddressId && primaryAddress && (
								<FormField
									control={createForm.control}
									name="usePrimaryAddress"
									render={({ field }) => (
										<FormItem className="flex flex-row items-start space-x-3 space-y-0">
											<FormControl>
												<Checkbox
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<div className="space-y-1 leading-none">
												<FormLabel>Use competition address</FormLabel>
												<FormDescription>
													{primaryAddress.name ||
														`${primaryAddress.city}, ${primaryAddress.stateProvince}`}
												</FormDescription>
											</div>
										</FormItem>
									)}
								/>
							)}

							{/* Custom Address Fields */}
							{!usePrimaryAddressCreate && (
								<div className="rounded-lg border p-4">
									<p className="text-sm font-medium mb-4">Venue Address</p>
									<AddressFields form={createForm} prefix="address" />
								</div>
							)}

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsCreateOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isCreating}>
									{isCreating && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									Create
								</Button>
							</div>
						</form>
					</Form>
				</DialogContent>
			</Dialog>

			{/* Edit Venue Dialog */}
			<Dialog
				open={!!editingVenue}
				onOpenChange={(open) => {
					if (!open) {
						setEditingVenue(null)
						editForm.reset(defaultFormValues)
					}
				}}
			>
				<DialogContent className="max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Venue</DialogTitle>
					</DialogHeader>
					<Form {...editForm}>
						<form
							onSubmit={editForm.handleSubmit(handleUpdate)}
							className="space-y-4"
						>
							<FormField
								control={editForm.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Venue Name</FormLabel>
										<FormControl>
											<Input placeholder="Main Floor" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={editForm.control}
									name="laneCount"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Number of Lanes</FormLabel>
											<FormControl>
												<Input
													type="number"
													min={1}
													max={100}
													value={field.value}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<FormDescription>Max athletes per heat</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={editForm.control}
									name="transitionMinutes"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Transition Time (min)</FormLabel>
											<FormControl>
												<Input
													type="number"
													min={0}
													max={120}
													value={field.value}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<FormDescription>Time between heats</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{/* Primary Address Option */}
							{primaryAddressId && primaryAddress && (
								<FormField
									control={editForm.control}
									name="usePrimaryAddress"
									render={({ field }) => (
										<FormItem className="flex flex-row items-start space-x-3 space-y-0">
											<FormControl>
												<Checkbox
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<div className="space-y-1 leading-none">
												<FormLabel>Use competition address</FormLabel>
												<FormDescription>
													{primaryAddress.name ||
														`${primaryAddress.city}, ${primaryAddress.stateProvince}`}
												</FormDescription>
											</div>
										</FormItem>
									)}
								/>
							)}

							{/* Custom Address Fields */}
							{!usePrimaryAddressEdit && (
								<div className="rounded-lg border p-4">
									<p className="text-sm font-medium mb-4">Venue Address</p>
									<AddressFields form={editForm} prefix="address" />
								</div>
							)}

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setEditingVenue(null)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isUpdating}>
									{isUpdating && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									Save
								</Button>
							</div>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		</div>
	)
}
