"use client"

import { useServerAction } from "@repo/zsa-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
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
import type { Limit } from "@/db/schemas/entitlements"
import {
	assignLimitToPlanAction,
	getAllLimitsAction,
} from "../../../_actions/entitlement-admin-actions"

interface AddLimitDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	planId: string
	excludeLimitIds: string[]
	onSuccess: () => void
}

export function AddLimitDialog({
	open,
	onOpenChange,
	planId,
	excludeLimitIds,
	onSuccess,
}: AddLimitDialogProps) {
	const [selectedLimitId, setSelectedLimitId] = useState<string>("")
	const [value, setValue] = useState<string>("")
	const [isUnlimited, setIsUnlimited] = useState(false)

	const { execute: fetchLimits, data: limitsData } =
		useServerAction(getAllLimitsAction)
	const { execute: assignLimit, isPending } = useServerAction(
		assignLimitToPlanAction,
	)

	useEffect(() => {
		if (open) {
			fetchLimits()
			setSelectedLimitId("")
			setValue("")
			setIsUnlimited(false)
		}
	}, [fetchLimits, open])

	const allLimits = (limitsData?.data ?? []) as Limit[]
	const availableLimits = allLimits.filter(
		(l) => l.isActive && !excludeLimitIds.includes(l.id),
	)

	const handleSubmit = async () => {
		if (!selectedLimitId) return

		const numValue = isUnlimited ? -1 : Number.parseInt(value, 10)
		if (!isUnlimited && (Number.isNaN(numValue) || numValue < 0)) return

		const [result] = await assignLimit({
			planId,
			limitId: selectedLimitId,
			value: numValue,
		})

		if (result?.success) {
			onSuccess()
		}
	}

	const selectedLimit = allLimits.find((l) => l.id === selectedLimitId)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Limit to Plan</DialogTitle>
					<DialogDescription>
						Select a limit and set its value for this plan
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="limit">Limit *</Label>
						<Select value={selectedLimitId} onValueChange={setSelectedLimitId}>
							<SelectTrigger>
								<SelectValue placeholder="Select a limit..." />
							</SelectTrigger>
							<SelectContent>
								{availableLimits.length === 0 ? (
									<div className="p-4 text-sm text-muted-foreground text-center">
										No available limits
									</div>
								) : (
									availableLimits.map((limit) => (
										<SelectItem key={limit.id} value={limit.id}>
											<div className="flex items-center gap-2">
												<span>{limit.name}</span>
												<Badge variant="outline" className="text-xs">
													{limit.unit}
												</Badge>
											</div>
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>

					{selectedLimit && (
						<div className="rounded-md bg-muted p-3 space-y-1">
							<div className="text-sm font-medium">{selectedLimit.name}</div>
							{selectedLimit.description && (
								<div className="text-xs text-muted-foreground">
									{selectedLimit.description}
								</div>
							)}
							<div className="flex gap-2 pt-1">
								<Badge variant="outline">{selectedLimit.key}</Badge>
								<Badge>{selectedLimit.unit}</Badge>
								<Badge variant="secondary">{selectedLimit.resetPeriod}</Badge>
							</div>
						</div>
					)}

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
							!selectedLimitId ||
							(!isUnlimited && (!value || Number.parseInt(value, 10) < 0))
						}
					>
						{isPending ? "Adding..." : "Add Limit"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
