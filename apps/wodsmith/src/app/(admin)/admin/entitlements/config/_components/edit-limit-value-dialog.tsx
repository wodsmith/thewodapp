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
import { Checkbox } from "@/components/ui/checkbox"
import { updatePlanLimitValueAction } from "../../../_actions/entitlement-admin-actions"

interface EditLimitValueDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	planLimitId: string
	currentValue: number
	onSuccess: () => void
}

export function EditLimitValueDialog({
	open,
	onOpenChange,
	planLimitId,
	currentValue,
	onSuccess,
}: EditLimitValueDialogProps) {
	const [value, setValue] = useState<string>("")
	const [isUnlimited, setIsUnlimited] = useState(false)

	const { execute: updateValue, isPending } = useServerAction(
		updatePlanLimitValueAction,
	)

	useEffect(() => {
		if (open) {
			if (currentValue === -1) {
				setIsUnlimited(true)
				setValue("")
			} else {
				setIsUnlimited(false)
				setValue(String(currentValue))
			}
		}
	}, [open, currentValue])

	const handleSubmit = async () => {
		const numValue = isUnlimited ? -1 : Number.parseInt(value, 10)
		if (!isUnlimited && (Number.isNaN(numValue) || numValue < 0)) return

		const [result] = await updateValue({
			planLimitId,
			value: numValue,
		})

		if (result?.success) {
			onSuccess()
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Limit Value</DialogTitle>
					<DialogDescription>
						Update the limit value for this plan
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="value">Value *</Label>
						<div className="space-y-3">
							<Input
								id="value"
								type="number"
								min="0"
								value={value}
								onChange={(e) => setValue(e.target.value)}
								placeholder="Enter limit value"
								disabled={isUnlimited}
							/>
							<div className="flex items-center space-x-2">
								<Checkbox
									id="unlimited"
									checked={isUnlimited}
									onCheckedChange={(checked) =>
										setIsUnlimited(checked === true)
									}
								/>
								<Label htmlFor="unlimited" className="text-sm font-normal">
									Unlimited (-1)
								</Label>
							</div>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							isPending ||
							(!isUnlimited && (!value || Number.parseInt(value, 10) < 0))
						}
					>
						{isPending ? "Updating..." : "Update"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
