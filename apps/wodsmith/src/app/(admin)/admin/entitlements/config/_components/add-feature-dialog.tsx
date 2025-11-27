"use client"

import { useServerAction } from "@repo/zsa-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
	getAllFeaturesAction,
	assignFeatureToPlanAction,
} from "../../../_actions/entitlement-admin-actions"
import type { Feature } from "@/db/schemas/entitlements"

interface AddFeatureDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	planId: string
	excludeFeatureIds: string[]
	onSuccess: () => void
}

export function AddFeatureDialog({
	open,
	onOpenChange,
	planId,
	excludeFeatureIds,
	onSuccess,
}: AddFeatureDialogProps) {
	const [selectedFeatureId, setSelectedFeatureId] = useState<string>("")

	const { execute: fetchFeatures, data: featuresData } =
		useServerAction(getAllFeaturesAction)
	const { execute: assignFeature, isPending } = useServerAction(
		assignFeatureToPlanAction,
	)

	useEffect(() => {
		if (open) {
			fetchFeatures()
			setSelectedFeatureId("")
		}
	}, [fetchFeatures, open])

	const allFeatures = (featuresData?.data ?? []) as Feature[]
	const availableFeatures = allFeatures.filter(
		(f) => f.isActive && !excludeFeatureIds.includes(f.id),
	)

	const handleSubmit = async () => {
		if (!selectedFeatureId) return

		const [result] = await assignFeature({
			planId,
			featureId: selectedFeatureId,
		})

		if (result?.success) {
			onSuccess()
		}
	}

	const selectedFeature = allFeatures.find((f) => f.id === selectedFeatureId)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Feature to Plan</DialogTitle>
					<DialogDescription>
						Select a feature to add to this plan
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="feature">Feature *</Label>
						<Select value={selectedFeatureId} onValueChange={setSelectedFeatureId}>
							<SelectTrigger>
								<SelectValue placeholder="Select a feature..." />
							</SelectTrigger>
							<SelectContent>
								{availableFeatures.length === 0 ? (
									<div className="p-4 text-sm text-muted-foreground text-center">
										No available features
									</div>
								) : (
									availableFeatures.map((feature) => (
										<SelectItem key={feature.id} value={feature.id}>
											<div className="flex items-center gap-2">
												<span>{feature.name}</span>
												<Badge variant="outline" className="text-xs">
													{feature.category}
												</Badge>
											</div>
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>

					{selectedFeature && (
						<div className="rounded-md bg-muted p-3 space-y-1">
							<div className="text-sm font-medium">{selectedFeature.name}</div>
							{selectedFeature.description && (
								<div className="text-xs text-muted-foreground">
									{selectedFeature.description}
								</div>
							)}
							<div className="flex gap-2 pt-1">
								<Badge variant="outline">{selectedFeature.key}</Badge>
								<Badge>{selectedFeature.category}</Badge>
							</div>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isPending || !selectedFeatureId}
					>
						{isPending ? "Adding..." : "Add Feature"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
