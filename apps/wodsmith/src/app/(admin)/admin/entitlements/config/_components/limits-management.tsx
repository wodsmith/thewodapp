"use client"

import { useServerAction } from "@repo/zsa-react"
import { Pencil, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import type { Limit } from "@/db/schemas/entitlements"
import { getAllLimitsAction } from "../../../_actions/entitlement-admin-actions"
import { LimitDialog } from "./limit-dialog"

export function LimitsManagement() {
	const [selectedLimit, setSelectedLimit] = useState<Limit | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)

	const {
		execute: fetchLimits,
		data: limitsData,
		isPending,
	} = useServerAction(getAllLimitsAction)

	useEffect(() => {
		fetchLimits()
	}, [fetchLimits])

	const limits = (limitsData?.data ?? []) as Limit[]

	const handleCreateLimit = () => {
		setSelectedLimit(null)
		setIsDialogOpen(true)
	}

	const handleEditLimit = (limit: Limit) => {
		setSelectedLimit(limit)
		setIsDialogOpen(true)
	}

	const handleLimitSaved = () => {
		fetchLimits()
		setIsDialogOpen(false)
	}

	const getResetPeriodBadgeColor = (resetPeriod: string) => {
		const colors: Record<string, "default" | "secondary" | "outline"> = {
			monthly: "default",
			yearly: "secondary",
			never: "outline",
		}
		return colors[resetPeriod] ?? "outline"
	}

	return (
		<>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Limits</CardTitle>
						<CardDescription>
							Manage usage limits that can be assigned to plans
						</CardDescription>
					</div>
					<Button onClick={handleCreateLimit}>
						<Plus className="w-4 h-4 mr-2" />
						Add Limit
					</Button>
				</CardHeader>
				<CardContent>
					{isPending ? (
						<div className="text-center py-8 text-muted-foreground">
							Loading limits...
						</div>
					) : limits.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No limits found. Create your first limit to get started.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Key</TableHead>
									<TableHead>Unit</TableHead>
									<TableHead>Reset Period</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{limits.map((limit: Limit) => (
									<TableRow key={limit.id}>
										<TableCell className="font-medium">
											{limit.name}
											{limit.description && (
												<div className="text-xs text-muted-foreground mt-1">
													{limit.description}
												</div>
											)}
										</TableCell>
										<TableCell>
											<code className="text-xs bg-muted px-2 py-1 rounded">
												{limit.key}
											</code>
										</TableCell>
										<TableCell>{limit.unit}</TableCell>
										<TableCell>
											<Badge
												variant={getResetPeriodBadgeColor(limit.resetPeriod)}
											>
												{limit.resetPeriod}
											</Badge>
										</TableCell>
										<TableCell>
											<Badge variant={limit.isActive ? "default" : "outline"}>
												{limit.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleEditLimit(limit)}
											>
												<Pencil className="w-4 h-4" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<LimitDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				limit={selectedLimit}
				onSuccess={handleLimitSaved}
			/>
		</>
	)
}
