"use client"

import { useServerAction } from "@repo/zsa-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Feature } from "@/db/schemas/entitlements"
import {
	createFeatureAction,
	updateFeatureAction,
} from "../../../_actions/entitlement-admin-actions"

interface FeatureDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	feature: Feature | null
	onSuccess: () => void
}

const CATEGORIES = [
	{ value: "workouts", label: "Workouts" },
	{ value: "programming", label: "Programming" },
	{ value: "scaling", label: "Scaling" },
	{ value: "ai", label: "AI" },
	{ value: "team", label: "Team" },
	{ value: "integration", label: "Integration" },
	{ value: "analytics", label: "Analytics" },
] as const

export function FeatureDialog({
	open,
	onOpenChange,
	feature,
	onSuccess,
}: FeatureDialogProps) {
	const isEditing = !!feature

	const [key, setKey] = useState("")
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [category, setCategory] = useState<string>("workouts")
	const [isActive, setIsActive] = useState(true)

	const { execute: createFeature, isPending: isCreating } =
		useServerAction(createFeatureAction)
	const { execute: updateFeature, isPending: isUpdating } =
		useServerAction(updateFeatureAction)

	useEffect(() => {
		if (feature) {
			setKey(feature.key)
			setName(feature.name)
			setDescription(feature.description ?? "")
			setCategory(feature.category)
			setIsActive(!!feature.isActive)
		} else {
			setKey("")
			setName("")
			setDescription("")
			setCategory("workouts")
			setIsActive(true)
		}
	}, [feature])

	const handleSubmit = async () => {
		try {
			if (isEditing) {
				const [result] = await updateFeature({
					id: feature.id,
					name,
					description: description || undefined,
					category: category as any,
					isActive,
				})
				if (result?.success) {
					onSuccess()
				}
			} else {
				const [result] = await createFeature({
					key,
					name,
					description: description || undefined,
					category: category as any,
				})
				if (result?.success) {
					onSuccess()
				}
			}
		} catch (error) {
			console.error("Error saving feature:", error)
		}
	}

	const isPending = isCreating || isUpdating

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Feature" : "Create Feature"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update the feature details below."
							: "Add a new feature that can be assigned to plans."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{!isEditing && (
						<div className="space-y-2">
							<Label htmlFor="key">Key *</Label>
							<Input
								id="key"
								value={key}
								onChange={(e) => setKey(e.target.value)}
								placeholder="e.g., programming_tracks"
							/>
							<p className="text-xs text-muted-foreground">
								Unique identifier for this feature (cannot be changed later)
							</p>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="name">Name *</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Programming Tracks"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional description of this feature"
							rows={3}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="category">Category *</Label>
						<Select value={category} onValueChange={setCategory}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CATEGORIES.map((cat) => (
									<SelectItem key={cat.value} value={cat.value}>
										{cat.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{isEditing && (
						<div className="flex items-center space-x-2">
							<Checkbox
								id="isActive"
								checked={isActive}
								onCheckedChange={(checked) => setIsActive(checked === true)}
							/>
							<Label htmlFor="isActive">Active</Label>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={isPending || !key || !name}>
						{isPending ? "Saving..." : isEditing ? "Update" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
