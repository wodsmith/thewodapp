"use client"

import { useServerAction } from "@repo/zsa-react"
import { Crown, Shield, User } from "lucide-react"
import { useState } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { Plan } from "@/db/schema"
import { updateTeamPlanAction } from "../../_actions/entitlement-admin-actions"

interface ChangePlanDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	teamId: string
	currentPlanId: string | null
	plans: Plan[]
	onSuccess: () => void
}

export function ChangePlanDialog({
	open,
	onOpenChange,
	teamId,
	currentPlanId,
	plans,
	onSuccess,
}: ChangePlanDialogProps) {
	const [selectedPlanId, setSelectedPlanId] = useState(currentPlanId ?? "free")
	const [reason, setReason] = useState("")
	const { toast } = useToast()

	const { execute: updatePlan, isPending } = useServerAction(
		updateTeamPlanAction,
		{
			onSuccess: () => {
				toast({
					title: "Plan Updated",
					description: "Team plan has been updated successfully",
				})
				onSuccess()
				setReason("")
			},
			onError: ({ err }) => {
				toast({
					title: "Error",
					description: err.message || "Failed to update plan",
					variant: "destructive",
				})
			},
		},
	)

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		updatePlan({
			teamId,
			planId: selectedPlanId,
			reason: reason.trim() || undefined,
		})
	}

	const getPlanIcon = (planId: string) => {
		if (planId === "free") return <User className="w-4 h-4" />
		if (planId === "pro") return <Shield className="w-4 h-4" />
		if (planId === "enterprise") return <Crown className="w-4 h-4" />
		return null
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Change Team Plan</DialogTitle>
						<DialogDescription>
							Select a new plan for this team. This will immediately update their
							entitlements and limits.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="space-y-3">
							<Label>Select Plan</Label>
							<RadioGroup
								value={selectedPlanId}
								onValueChange={setSelectedPlanId}
								className="grid gap-3"
							>
								{plans.map((plan) => (
									<div
										key={plan.id}
										className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer"
									>
										<RadioGroupItem value={plan.id} id={plan.id} />
										<Label
											htmlFor={plan.id}
											className="flex items-center gap-2 cursor-pointer flex-1"
										>
											{getPlanIcon(plan.id)}
											<div className="flex-1">
												<div className="font-medium">{plan.name}</div>
												<div className="text-sm text-muted-foreground">
													{plan.description}
												</div>
											</div>
											<div className="text-sm font-medium">
												{plan.price === 0
													? "Free"
													: `$${(plan.price / 100).toFixed(0)}/mo`}
											</div>
										</Label>
									</div>
								))}
							</RadioGroup>
						</div>

						<div className="space-y-2">
							<Label htmlFor="reason">Reason (Optional)</Label>
							<Textarea
								id="reason"
								placeholder="Why are you changing this team's plan?"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								rows={3}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? "Updating..." : "Update Plan"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
