"use client"

import { useServerAction } from "@repo/zsa-react"
import { Check, Info } from "lucide-react"
import { useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"

interface SnapshotFeature {
	id: string
	featureName: string
	featureDescription?: string | null
	featureCategory?: string | null
	source: string
}

interface SnapshotLimit {
	id: string
	limitName: string
	limitDescription?: string | null
	limitUnit?: string | null
	limitResetPeriod: string
	value: number
	currentUsage: number
	source: string
}

import { Progress } from "@/components/ui/progress"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { getTeamEntitlementSnapshotAction } from "../../_actions"

interface TeamEntitlementsDetailProps {
	teamId: string
}

export function TeamEntitlementsDetail({
	teamId,
}: TeamEntitlementsDetailProps) {
	const { execute, data, isPending, error } = useServerAction(
		getTeamEntitlementSnapshotAction,
	)

	useEffect(() => {
		execute({ teamId })
	}, [execute, teamId])

	if (isPending) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				Loading entitlements...
			</div>
		)
	}

	if (error || !data?.data) {
		return (
			<div className="py-8 text-center text-destructive">
				Failed to load entitlements
			</div>
		)
	}

	const snapshot = data.data

	// Group features by category
	const featuresByCategory = (snapshot.features as SnapshotFeature[]).reduce(
		(acc: Record<string, SnapshotFeature[]>, feature: SnapshotFeature) => {
			const category = feature.featureCategory || "other"
			if (!acc[category]) {
				acc[category] = []
			}
			acc[category].push(feature)
			return acc
		},
		{} as Record<string, SnapshotFeature[]>,
	)

	return (
		<div className="space-y-4 p-4 bg-muted/30">
			{/* Features */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Features</CardTitle>
					<CardDescription>
						Active features for this team ({snapshot.features.length} total)
					</CardDescription>
				</CardHeader>
				<CardContent>
					{snapshot.features.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4">
							No features enabled
						</p>
					) : (
						<div className="space-y-4">
							{Object.entries(featuresByCategory).map(
								([category, features]: [string, SnapshotFeature[]]) => (
									<div key={category}>
										<h4 className="text-xs font-semibold mb-2 capitalize text-muted-foreground">
											{category.replace(/_/g, " ")}
										</h4>
										<div className="space-y-2">
											{features.map((feature: SnapshotFeature) => (
												<div
													key={feature.id}
													className="flex items-start gap-2 p-2 rounded border bg-card text-sm"
												>
													<Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
													<div className="flex-1 space-y-0.5">
														<div className="flex items-center gap-2">
															<span className="font-medium">
																{feature.featureName}
															</span>
															{feature.source !== "plan" && (
																<Badge
																	variant="secondary"
																	className="text-xs h-5"
																>
																	{feature.source}
																</Badge>
															)}
														</div>
														{feature.featureDescription && (
															<p className="text-xs text-muted-foreground">
																{feature.featureDescription}
															</p>
														)}
													</div>
												</div>
											))}
										</div>
									</div>
								),
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Limits */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Limits & Usage</CardTitle>
					<CardDescription>
						Resource limits and current usage ({snapshot.limits.length} limits)
					</CardDescription>
				</CardHeader>
				<CardContent>
					{snapshot.limits.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4">
							No limits configured
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-xs">Limit</TableHead>
									<TableHead className="text-xs">Usage</TableHead>
									<TableHead className="text-xs">Maximum</TableHead>
									<TableHead className="text-xs">Reset</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(snapshot.limits as SnapshotLimit[]).map(
									(limit: SnapshotLimit) => {
										const usage = limit.currentUsage
										const max = limit.value
										const percentage =
											max === -1 ? 0 : Math.min((usage / max) * 100, 100)
										const isUnlimited = max === -1

										return (
											<TableRow key={limit.id}>
												<TableCell>
													<div className="space-y-0.5">
														<p className="text-sm font-medium">
															{limit.limitName}
														</p>
														{limit.limitDescription && (
															<p className="text-xs text-muted-foreground">
																{limit.limitDescription}
															</p>
														)}
														{limit.source !== "plan" && (
															<Badge
																variant="secondary"
																className="text-xs h-5"
															>
																{limit.source}
															</Badge>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1.5 max-w-[200px]">
														<div className="flex items-center gap-2">
															<span className="text-xs font-mono">
																{usage}
																{isUnlimited ? "" : ` / ${max}`}{" "}
																{limit.limitUnit}
															</span>
															{isUnlimited && (
																<Badge
																	variant="outline"
																	className="text-xs h-5"
																>
																	Unlimited
																</Badge>
															)}
														</div>
														{!isUnlimited && (
															<Progress value={percentage} className="h-1.5" />
														)}
													</div>
												</TableCell>
												<TableCell>
													<span className="text-sm font-mono">
														{isUnlimited ? "∞" : max}
													</span>
												</TableCell>
												<TableCell>
													<Badge
														variant="secondary"
														className="capitalize text-xs h-5"
													>
														{limit.limitResetPeriod}
													</Badge>
												</TableCell>
											</TableRow>
										)
									},
								)}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Info */}
			<Card className="bg-muted/50">
				<CardContent className="pt-4 pb-3">
					<div className="flex gap-2">
						<Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
						<p className="text-xs text-muted-foreground">
							Entitlements are snapshotted from the{" "}
							<strong>{snapshot.team.currentPlanName}</strong> plan. Overrides
							show as "override" source.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
