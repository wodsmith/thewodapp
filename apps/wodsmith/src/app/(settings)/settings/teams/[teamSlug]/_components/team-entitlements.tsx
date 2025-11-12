import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { getTeamEntitlementSnapshot } from "@/server/entitlements"
import { Check, Info } from "lucide-react"

interface TeamEntitlementsProps {
	teamId: string
}

export async function TeamEntitlements({ teamId }: TeamEntitlementsProps) {
	const snapshot = await getTeamEntitlementSnapshot(teamId)

	// Group features by category
	const featuresByCategory = snapshot.features.reduce(
		(acc, feature) => {
			const category = feature.featureCategory || "other"
			if (!acc[category]) {
				acc[category] = []
			}
			acc[category].push(feature)
			return acc
		},
		{} as Record<string, typeof snapshot.features>,
	)

	return (
		<div className="space-y-6">
			{/* Plan Info */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Current Plan</CardTitle>
						<Badge variant="outline" className="text-lg font-semibold">
							{snapshot.team.currentPlanName}
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						Your team's entitlements are snapshotted from the{" "}
						<span className="font-semibold">
							{snapshot.team.currentPlanName}
						</span>{" "}
						plan. These are locked to your team and won't change if the plan
						definition is updated.
					</p>
				</CardContent>
			</Card>

			{/* Features */}
			<Card>
				<CardHeader>
					<CardTitle>Features</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-6">
						{Object.entries(featuresByCategory).map(([category, features]) => (
							<div key={category}>
								<h3 className="text-sm font-semibold mb-3 capitalize text-muted-foreground">
									{category.replace(/_/g, " ")}
								</h3>
								<div className="space-y-2">
									{features.map((feature) => (
										<div
											key={feature.id}
											className="flex items-start gap-3 p-3 rounded-lg border bg-card"
										>
											<Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
											<div className="flex-1 space-y-1">
												<div className="flex items-center gap-2">
													<p className="font-medium">{feature.featureName}</p>
													{feature.source !== "plan" && (
														<Badge variant="secondary" className="text-xs">
															{feature.source}
														</Badge>
													)}
												</div>
												{feature.featureDescription && (
													<p className="text-sm text-muted-foreground">
														{feature.featureDescription}
													</p>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Limits */}
			<Card>
				<CardHeader>
					<CardTitle>Limits & Usage</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Limit</TableHead>
								<TableHead>Usage</TableHead>
								<TableHead>Maximum</TableHead>
								<TableHead>Reset Period</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{snapshot.limits.map((limit) => {
								const usage = limit.currentUsage
								const max = limit.value
								const percentage =
									max === -1 ? 0 : Math.min((usage / max) * 100, 100)
								const isUnlimited = max === -1

								return (
									<TableRow key={limit.id}>
										<TableCell>
											<div className="space-y-1">
												<p className="font-medium">{limit.limitName}</p>
												{limit.limitDescription && (
													<p className="text-xs text-muted-foreground">
														{limit.limitDescription}
													</p>
												)}
											</div>
										</TableCell>
										<TableCell>
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													<span className="text-sm font-mono">
														{usage}
														{isUnlimited ? "" : ` / ${max}`} {limit.limitUnit}
													</span>
													{isUnlimited && (
														<Badge variant="outline" className="text-xs">
															Unlimited
														</Badge>
													)}
												</div>
												{!isUnlimited && (
													<Progress value={percentage} className="h-2" />
												)}
											</div>
										</TableCell>
										<TableCell>
											<span className="font-mono">
												{isUnlimited ? "∞" : max}
											</span>
										</TableCell>
										<TableCell>
											<Badge variant="secondary" className="capitalize">
												{limit.limitResetPeriod}
											</Badge>
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Info Footer */}
			<Card className="bg-muted/50">
				<CardContent className="pt-6">
					<div className="flex gap-3">
						<Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
						<div className="text-sm text-muted-foreground space-y-2">
							<p>
								<strong>About Entitlements:</strong> Your team's features and
								limits are snapshotted when you subscribe to a plan. This means
								you keep what you paid for, even if the plan changes in the
								future.
							</p>
							<p>
								If you change plans, your entitlements will be updated to match
								the new plan.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
