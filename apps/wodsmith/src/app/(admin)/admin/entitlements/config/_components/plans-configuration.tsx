"use client"

import { useServerAction } from "@repo/zsa-react"
import { Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { getAllPlansAction } from "../../../_actions/entitlement-admin-actions"
import { PlanConfigDialog } from "./plan-config-dialog"
import type { Plan } from "@/db/schemas/entitlements"

export function PlansConfiguration() {
	const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)

	const { execute: fetchPlans, data: plansData, isPending } =
		useServerAction(getAllPlansAction)

	useEffect(() => {
		fetchPlans()
	}, [fetchPlans])

	const plans = plansData?.data ?? []

	const handleConfigurePlan = (plan: Plan) => {
		setSelectedPlan(plan)
		setIsDialogOpen(true)
	}

	const handleConfigSaved = () => {
		fetchPlans()
		setIsDialogOpen(false)
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Plan Configuration</CardTitle>
					<CardDescription>
						Configure which features and limits are available in each plan
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPending ? (
						<div className="text-center py-8 text-muted-foreground">
							Loading plans...
						</div>
					) : plans.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No plans found.
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{plans.map((plan) => (
								<Card key={plan.id}>
									<CardHeader>
										<CardTitle className="text-lg">{plan.name}</CardTitle>
										{plan.description && (
											<CardDescription>{plan.description}</CardDescription>
										)}
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="text-sm text-muted-foreground">
												{plan.interval && (
													<div>
														${(plan.price / 100).toFixed(2)}/{plan.interval}
													</div>
												)}
												{!plan.interval && plan.price === 0 && (
													<div>Free</div>
												)}
											</div>
											<Button
												variant="outline"
												size="sm"
												className="w-full"
												onClick={() => handleConfigurePlan(plan)}
											>
												<Settings className="w-4 h-4 mr-2" />
												Configure
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{selectedPlan && (
				<PlanConfigDialog
					open={isDialogOpen}
					onOpenChange={setIsDialogOpen}
					plan={selectedPlan}
					onSuccess={handleConfigSaved}
				/>
			)}
		</>
	)
}
