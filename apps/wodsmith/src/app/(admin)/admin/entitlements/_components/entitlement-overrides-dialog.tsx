"use client"

import { useServerAction } from "@repo/zsa-react"
import { Plus, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { useToast } from "@/hooks/use-toast"
import {
	addEntitlementOverrideAction,
	getAllFeaturesAction,
	getAllLimitsAction,
	getTeamOverridesAction,
	removeEntitlementOverrideAction,
} from "../../_actions"
import type {
	Feature,
	Limit,
	TeamEntitlementOverride,
} from "@/db/schemas/entitlements"
import { Badge } from "@/components/ui/badge"

interface EntitlementOverridesDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	teamId: string
	teamName: string
}

export function EntitlementOverridesDialog({
	open,
	onOpenChange,
	teamId,
	teamName,
}: EntitlementOverridesDialogProps) {
	const [showAddForm, setShowAddForm] = useState(false)
	const [type, setType] = useState<"feature" | "limit">("feature")
	const [key, setKey] = useState("")
	const [value, setValue] = useState("")
	const [reason, setReason] = useState("")
	const { toast } = useToast()

	const {
		execute: fetchOverrides,
		data: overridesData,
		isPending: isLoadingOverrides,
	} = useServerAction(getTeamOverridesAction)

	const { execute: fetchFeatures, data: featuresData } =
		useServerAction(getAllFeaturesAction)

	const { execute: fetchLimits, data: limitsData } =
		useServerAction(getAllLimitsAction)

	const { execute: addOverride, isPending: isAdding } = useServerAction(
		addEntitlementOverrideAction,
		{
			onSuccess: () => {
				toast({
					title: "Override Added",
					description: "Entitlement override has been added successfully",
				})
				fetchOverrides({ teamId })
				setShowAddForm(false)
				resetForm()
			},
			onError: ({ err }) => {
				toast({
					title: "Error",
					description: err.message || "Failed to add override",
					variant: "destructive",
				})
			},
		},
	)

	const { execute: removeOverride } = useServerAction(
		removeEntitlementOverrideAction,
		{
			onSuccess: () => {
				toast({
					title: "Override Removed",
					description: "Entitlement override has been removed",
				})
				fetchOverrides({ teamId })
			},
			onError: ({ err }) => {
				toast({
					title: "Error",
					description: err.message || "Failed to remove override",
					variant: "destructive",
				})
			},
		},
	)

	useEffect(() => {
		if (open) {
			fetchOverrides({ teamId })
			fetchFeatures()
			fetchLimits()
		}
	}, [open, teamId, fetchOverrides, fetchFeatures, fetchLimits])

	const resetForm = () => {
		setType("feature")
		setKey("")
		setValue("")
		setReason("")
	}

	const handleAddOverride = (e: React.FormEvent) => {
		e.preventDefault()
		addOverride({
			teamId,
			type,
			key,
			value,
			reason,
		})
	}

	const overrides = (overridesData?.data ?? []) as TeamEntitlementOverride[]
	const features = (featuresData?.data ?? []) as Feature[]
	const limits = (limitsData?.data ?? []) as Limit[]

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Entitlement Overrides - {teamName}</DialogTitle>
					<DialogDescription>
						Manually override features and limits for this team. These overrides
						take precedence over the team's plan.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Existing Overrides */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-sm font-medium">Active Overrides</h3>
							{!showAddForm && (
								<Button
									size="sm"
									variant="outline"
									onClick={() => setShowAddForm(true)}
								>
									<Plus className="w-4 h-4 mr-1" />
									Add Override
								</Button>
							)}
						</div>

						{isLoadingOverrides ? (
							<div className="text-center py-4 text-sm text-muted-foreground">
								Loading overrides...
							</div>
						) : overrides.length === 0 ? (
							<div className="text-center py-8 border rounded-lg">
								<p className="text-sm text-muted-foreground">
									No overrides configured
								</p>
							</div>
						) : (
							<div className="space-y-2">
								{overrides.map((override) => (
									<div
										key={override.id}
										className="flex items-start justify-between border rounded-lg p-3"
									>
										<div className="space-y-1 flex-1">
											<div className="flex items-center gap-2">
												<Badge
													variant={
														override.type === "feature"
															? "default"
															: "secondary"
													}
												>
													{override.type}
												</Badge>
												<span className="font-mono text-sm">
													{override.key}
												</span>
											</div>
											<div className="text-sm">
												<span className="text-muted-foreground">Value: </span>
												<span className="font-medium">{override.value}</span>
											</div>
											{override.reason && (
												<div className="text-xs text-muted-foreground">
													Reason: {override.reason}
												</div>
											)}
											{override.expiresAt && (
												<div className="text-xs text-muted-foreground">
													Expires:{" "}
													{new Date(override.expiresAt).toLocaleDateString()}
												</div>
											)}
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={() =>
												removeOverride({ overrideId: override.id })
											}
										>
											<Trash2 className="w-4 h-4 text-destructive" />
										</Button>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Add Override Form */}
					{showAddForm && (
						<form
							onSubmit={handleAddOverride}
							className="border rounded-lg p-4"
						>
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-sm font-medium">Add New Override</h3>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={() => {
										setShowAddForm(false)
										resetForm()
									}}
								>
									<X className="w-4 h-4" />
								</Button>
							</div>

							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Type</Label>
									<Select
										value={type}
										onValueChange={(val) => {
											setType(val as "feature" | "limit")
											setKey("")
										}}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="feature">Feature</SelectItem>
											<SelectItem value="limit">Limit</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label>{type === "feature" ? "Feature" : "Limit"}</Label>
									<Select value={key} onValueChange={setKey}>
										<SelectTrigger>
											<SelectValue placeholder={`Select a ${type}...`} />
										</SelectTrigger>
										<SelectContent>
											{type === "feature"
												? features.map((feature) => (
														<SelectItem key={feature.id} value={feature.key}>
															<div className="flex flex-col">
																<span className="font-medium">
																	{feature.name}
																</span>
																{feature.description && (
																	<span className="text-xs text-muted-foreground">
																		{feature.description}
																	</span>
																)}
															</div>
														</SelectItem>
													))
												: limits.map((limit) => (
														<SelectItem key={limit.id} value={limit.key}>
															<div className="flex flex-col">
																<span className="font-medium">
																	{limit.name}
																</span>
																{limit.description && (
																	<span className="text-xs text-muted-foreground">
																		{limit.description} ({limit.unit})
																	</span>
																)}
															</div>
														</SelectItem>
													))}
										</SelectContent>
									</Select>
									{type === "feature" && key && (
										<p className="text-xs text-muted-foreground">
											Selected: {features.find((f) => f.key === key)?.name}
										</p>
									)}
									{type === "limit" && key && (
										<p className="text-xs text-muted-foreground">
											Selected: {limits.find((l) => l.key === key)?.name}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label>Value</Label>
									{type === "feature" ? (
										<Select value={value} onValueChange={setValue}>
											<SelectTrigger>
												<SelectValue placeholder="Select value..." />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="true">Enabled</SelectItem>
												<SelectItem value="false">Disabled</SelectItem>
											</SelectContent>
										</Select>
									) : (
										<Input
											type="number"
											placeholder="Enter limit value (-1 for unlimited)"
											value={value}
											onChange={(e) => setValue(e.target.value)}
											required
										/>
									)}
								</div>

								<div className="space-y-2">
									<Label>Reason</Label>
									<Textarea
										placeholder="Why is this override needed?"
										value={reason}
										onChange={(e) => setReason(e.target.value)}
										rows={2}
										required
									/>
								</div>

								<div className="flex justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setShowAddForm(false)
											resetForm()
										}}
										disabled={isAdding}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isAdding}>
										{isAdding ? "Adding..." : "Add Override"}
									</Button>
								</div>
							</div>
						</form>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
