"use client"

import { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
	ScalingMigrationMapper,
	type DescriptionMapping,
} from "./scaling-migration-mapper"
import type { ScalingLevel, WorkoutScalingDescription } from "@/db/schema"

interface ScalingMigrationDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	originalWorkout: {
		id: string
		name: string
	}
	originalDescriptions: (WorkoutScalingDescription & {
		scalingLevel: ScalingLevel
	})[]
	newScalingLevels: ScalingLevel[]
	onMigrate: (mappings: DescriptionMapping[]) => Promise<void>
	onSkip: () => void
	isLoading?: boolean
}

export function ScalingMigrationDialog({
	open,
	onOpenChange,
	originalWorkout,
	originalDescriptions,
	newScalingLevels,
	onMigrate,
	onSkip,
	isLoading = false,
}: ScalingMigrationDialogProps) {
	const [isMigrating, setIsMigrating] = useState(false)

	const handleMigrate = async (mappings: DescriptionMapping[]) => {
		setIsMigrating(true)
		try {
			await onMigrate(mappings)
			onOpenChange(false)
		} finally {
			setIsMigrating(false)
		}
	}

	const handleSkip = () => {
		onSkip()
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[80vh]">
				<DialogHeader>
					<DialogTitle>Migrate Scaling Descriptions</DialogTitle>
				</DialogHeader>
				<ScrollArea className="max-h-[60vh] pr-4">
					<ScalingMigrationMapper
						originalWorkout={originalWorkout}
						originalDescriptions={originalDescriptions}
						newScalingLevels={newScalingLevels}
						onMigrate={handleMigrate}
						onSkip={handleSkip}
						isLoading={isMigrating || isLoading}
					/>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}
