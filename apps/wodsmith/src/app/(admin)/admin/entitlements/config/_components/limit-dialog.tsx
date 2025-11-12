"use client"

import { useServerAction } from "@repo/zsa-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
	createLimitAction,
	updateLimitAction,
} from "../../../_actions/entitlement-admin-actions"
import type { Limit } from "@/db/schemas/entitlements"

interface LimitDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	limit: Limit | null
	onSuccess: () => void
}

const RESET_PERIODS = [
	{ value: "never", label: "Never" },
	{ value: "monthly", label: "Monthly" },
	{ value: "yearly", label: "Yearly" },
] as const

export function LimitDialog({
	open,
	onOpenChange,
	limit,
	onSuccess,
}: LimitDialogProps) {
	const isEditing = !!limit

	const [key, setKey] = useState("")
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [unit, setUnit] = useState("")
	const [resetPeriod, setResetPeriod] = useState<string>("never")
	const [isActive, setIsActive] = useState(true)

	const { execute: createLimit, isPending: isCreating } =
		useServerAction(createLimitAction)
	const { execute: updateLimit, isPending: isUpdating } =
		useServerAction(updateLimitAction)

	useEffect(() => {
		if (limit) {
			setKey(limit.key)
			setName(limit.name)
			setDescription(limit.description ?? "")
			setUnit(limit.unit)
			setResetPeriod(limit.resetPeriod)
			setIsActive(!!limit.isActive)
		} else {
			setKey("")
			setName("")
			setDescription("")
			setUnit("")
			setResetPeriod("never")
			setIsActive(true)
		}
	}, [limit])

	const handleSubmit = async () => {
		try {
			if (isEditing) {
				const [result] = await updateLimit({
					id: limit.id,
					name,
					description: description || undefined,
					unit,
					resetPeriod: resetPeriod as any,
					isActive,
				})
				if (result?.success) {
					onSuccess()
				}
			} else {
				const [result] = await createLimit({
					key,
					name,
					description: description || undefined,
					unit,
					resetPeriod: resetPeriod as any,
				})
				if (result?.success) {
					onSuccess()
				}
			}
		} catch (error) {
			console.error("Error saving limit:", error)
		}
	}

	const isPending = isCreating || isUpdating

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isEditing ? "Edit Limit" : "Create Limit"}</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update the limit details below."
							: "Add a new usage limit that can be assigned to plans."}
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
								placeholder="e.g., max_teams"
							/>
							<p className="text-xs text-muted-foreground">
								Unique identifier for this limit (cannot be changed later)
							</p>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="name">Name *</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Maximum Teams"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional description of this limit"
							rows={3}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="unit">Unit *</Label>
						<Input
							id="unit"
							value={unit}
							onChange={(e) => setUnit(e.target.value)}
							placeholder="e.g., teams, MB, messages"
						/>
						<p className="text-xs text-muted-foreground">
							The unit of measurement for this limit
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="resetPeriod">Reset Period *</Label>
						<Select value={resetPeriod} onValueChange={setResetPeriod}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{RESET_PERIODS.map((period) => (
									<SelectItem key={period.value} value={period.value}>
										{period.label}
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
					<Button
						onClick={handleSubmit}
						disabled={isPending || !key || !name || !unit}
					>
						{isPending ? "Saving..." : isEditing ? "Update" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
