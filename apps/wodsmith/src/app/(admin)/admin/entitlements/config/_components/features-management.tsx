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
import { getAllFeaturesAction } from "../../../_actions/entitlement-admin-actions"
import { FeatureDialog } from "./feature-dialog"
import type { Feature } from "@/db/schemas/entitlements"

export function FeaturesManagement() {
	const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)

	const {
		execute: fetchFeatures,
		data: featuresData,
		isPending,
	} = useServerAction(getAllFeaturesAction)

	useEffect(() => {
		fetchFeatures()
	}, [fetchFeatures])

	const features = (featuresData?.data ?? []) as Feature[]

	const handleCreateFeature = () => {
		setSelectedFeature(null)
		setIsDialogOpen(true)
	}

	const handleEditFeature = (feature: Feature) => {
		setSelectedFeature(feature)
		setIsDialogOpen(true)
	}

	const handleFeatureSaved = () => {
		fetchFeatures()
		setIsDialogOpen(false)
	}

	const getCategoryBadgeColor = (category: string) => {
		const colors: Record<string, "default" | "secondary" | "outline"> = {
			workouts: "default",
			programming: "secondary",
			scaling: "outline",
			ai: "default",
			team: "secondary",
			integration: "outline",
			analytics: "default",
		}
		return colors[category] ?? "outline"
	}

	return (
		<>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Features</CardTitle>
						<CardDescription>
							Manage available features that can be assigned to plans
						</CardDescription>
					</div>
					<Button onClick={handleCreateFeature}>
						<Plus className="w-4 h-4 mr-2" />
						Add Feature
					</Button>
				</CardHeader>
				<CardContent>
					{isPending ? (
						<div className="text-center py-8 text-muted-foreground">
							Loading features...
						</div>
					) : features.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No features found. Create your first feature to get started.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Key</TableHead>
									<TableHead>Category</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{features.map((feature: Feature) => (
									<TableRow key={feature.id}>
										<TableCell className="font-medium">
											{feature.name}
											{feature.description && (
												<div className="text-xs text-muted-foreground mt-1">
													{feature.description}
												</div>
											)}
										</TableCell>
										<TableCell>
											<code className="text-xs bg-muted px-2 py-1 rounded">
												{feature.key}
											</code>
										</TableCell>
										<TableCell>
											<Badge variant={getCategoryBadgeColor(feature.category)}>
												{feature.category}
											</Badge>
										</TableCell>
										<TableCell>
											<Badge variant={feature.isActive ? "default" : "outline"}>
												{feature.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleEditFeature(feature)}
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

			<FeatureDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				feature={selectedFeature}
				onSuccess={handleFeatureSaved}
			/>
		</>
	)
}
