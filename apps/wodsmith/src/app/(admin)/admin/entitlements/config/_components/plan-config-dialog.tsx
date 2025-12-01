"use client"

import { useServerAction } from "@repo/zsa-react"
import { Plus, Trash2, Pencil } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import {
	getPlanConfigAction,
	removeFeatureFromPlanAction,
	removeLimitFromPlanAction,
} from "../../../_actions/entitlement-admin-actions"
import { AddFeatureDialog } from "./add-feature-dialog"
import { AddLimitDialog } from "./add-limit-dialog"
import { EditLimitValueDialog } from "./edit-limit-value-dialog"
import type { Plan } from "@/db/schemas/entitlements"

interface PlanConfigDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	plan: Plan
	onSuccess?: () => void
}

export function PlanConfigDialog({
	open,
	onOpenChange,
	plan,
	onSuccess: _onSuccess,
}: PlanConfigDialogProps) {
	const [isAddFeatureOpen, setIsAddFeatureOpen] = useState(false)
	const [isAddLimitOpen, setIsAddLimitOpen] = useState(false)
	const [editingLimitId, setEditingLimitId] = useState<string | null>(null)
	const [editingLimitValue, setEditingLimitValue] = useState<number>(0)

	const {
		execute: fetchPlanConfig,
		data: configData,
		isPending,
	} = useServerAction(getPlanConfigAction)

	const { execute: removeFeature } = useServerAction(
		removeFeatureFromPlanAction,
	)
	const { execute: removeLimit } = useServerAction(removeLimitFromPlanAction)

	useEffect(() => {
		if (open && plan) {
			fetchPlanConfig({ planId: plan.id })
		}
	}, [fetchPlanConfig, plan, open])

	const planConfig = configData?.data

	const handleRemoveFeature = async (planFeatureId: string) => {
		const [result] = await removeFeature({ planFeatureId })
		if (result?.success) {
			fetchPlanConfig({ planId: plan.id })
		}
	}

	const handleRemoveLimit = async (planLimitId: string) => {
		const [result] = await removeLimit({ planLimitId })
		if (result?.success) {
			fetchPlanConfig({ planId: plan.id })
		}
	}

	const handleEditLimitValue = (planLimitId: string, currentValue: number) => {
		setEditingLimitId(planLimitId)
		setEditingLimitValue(currentValue)
	}

	const handleFeatureAdded = () => {
		fetchPlanConfig({ planId: plan.id })
		setIsAddFeatureOpen(false)
	}

	const handleLimitAdded = () => {
		fetchPlanConfig({ planId: plan.id })
		setIsAddLimitOpen(false)
	}

	const handleLimitValueUpdated = () => {
		fetchPlanConfig({ planId: plan.id })
		setEditingLimitId(null)
	}

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Configure {plan.name} Plan</DialogTitle>
						<DialogDescription>
							Manage features and limits for this plan
						</DialogDescription>
					</DialogHeader>

					{isPending ? (
						<div className="text-center py-8 text-muted-foreground">
							Loading plan configuration...
						</div>
					) : (
						<div className="space-y-6">
							{/* Features Section */}
							<Card>
								<CardHeader className="flex flex-row items-center justify-between">
									<div>
										<CardTitle>Features</CardTitle>
										<CardDescription>
											Features available in this plan
										</CardDescription>
									</div>
									<Button
										size="sm"
										variant="outline"
										onClick={() => setIsAddFeatureOpen(true)}
									>
										<Plus className="w-4 h-4 mr-2" />
										Add Feature
									</Button>
								</CardHeader>
								<CardContent>
									{!planConfig?.planFeatures?.length ? (
										<div className="text-center py-4 text-muted-foreground text-sm">
											No features assigned to this plan
										</div>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Feature</TableHead>
													<TableHead>Key</TableHead>
													<TableHead>Category</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{planConfig.planFeatures.map((pf) => (
													<TableRow key={pf.id}>
														<TableCell className="font-medium">
															{pf.feature.name}
															{pf.feature.description && (
																<div className="text-xs text-muted-foreground mt-1">
																	{pf.feature.description}
																</div>
															)}
														</TableCell>
														<TableCell>
															<code className="text-xs bg-muted px-2 py-1 rounded">
																{pf.feature.key}
															</code>
														</TableCell>
														<TableCell>
															<Badge>{pf.feature.category}</Badge>
														</TableCell>
														<TableCell className="text-right">
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleRemoveFeature(pf.id)}
															>
																<Trash2 className="w-4 h-4 text-destructive" />
															</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>

							{/* Limits Section */}
							<Card>
								<CardHeader className="flex flex-row items-center justify-between">
									<div>
										<CardTitle>Limits</CardTitle>
										<CardDescription>
											Usage limits for this plan
										</CardDescription>
									</div>
									<Button
										size="sm"
										variant="outline"
										onClick={() => setIsAddLimitOpen(true)}
									>
										<Plus className="w-4 h-4 mr-2" />
										Add Limit
									</Button>
								</CardHeader>
								<CardContent>
									{!planConfig?.planLimits?.length ? (
										<div className="text-center py-4 text-muted-foreground text-sm">
											No limits assigned to this plan
										</div>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Limit</TableHead>
													<TableHead>Key</TableHead>
													<TableHead>Value</TableHead>
													<TableHead>Unit</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{planConfig.planLimits.map((pl) => (
													<TableRow key={pl.id}>
														<TableCell className="font-medium">
															{pl.limit.name}
															{pl.limit.description && (
																<div className="text-xs text-muted-foreground mt-1">
																	{pl.limit.description}
																</div>
															)}
														</TableCell>
														<TableCell>
															<code className="text-xs bg-muted px-2 py-1 rounded">
																{pl.limit.key}
															</code>
														</TableCell>
														<TableCell>
															<Badge variant="secondary">
																{pl.value === -1 ? "Unlimited" : pl.value}
															</Badge>
														</TableCell>
														<TableCell>{pl.limit.unit}</TableCell>
														<TableCell className="text-right space-x-2">
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	handleEditLimitValue(pl.id, pl.value)
																}
															>
																<Pencil className="w-4 h-4" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleRemoveLimit(pl.id)}
															>
																<Trash2 className="w-4 h-4 text-destructive" />
															</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Add Feature Dialog */}
			<AddFeatureDialog
				open={isAddFeatureOpen}
				onOpenChange={setIsAddFeatureOpen}
				planId={plan.id}
				excludeFeatureIds={
					planConfig?.planFeatures?.map((pf) => pf.feature.id) ?? []
				}
				onSuccess={handleFeatureAdded}
			/>

			{/* Add Limit Dialog */}
			<AddLimitDialog
				open={isAddLimitOpen}
				onOpenChange={setIsAddLimitOpen}
				planId={plan.id}
				excludeLimitIds={planConfig?.planLimits?.map((pl) => pl.limit.id) ?? []}
				onSuccess={handleLimitAdded}
			/>

			{/* Edit Limit Value Dialog */}
			{editingLimitId && (
				<EditLimitValueDialog
					open={!!editingLimitId}
					onOpenChange={(open) => !open && setEditingLimitId(null)}
					planLimitId={editingLimitId}
					currentValue={editingLimitValue}
					onSuccess={handleLimitValueUpdated}
				/>
			)}
		</>
	)
}
