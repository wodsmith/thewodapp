"use client"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Workout } from "@/db/schema"
import React from "react"

interface WorkoutCardProps {
	workout: Workout
	onAddToTrackAction: (workoutId: string) => void // Renamed prop
}

export function WorkoutCard({ workout, onAddToTrackAction }: WorkoutCardProps) {
	return (
		<Card className="flex flex-col h-full">
			<CardHeader>
				<CardTitle className="truncate" title={workout.name}>
					{workout.name}
				</CardTitle>
				{workout.description && (
					<CardDescription className="truncate" title={workout.description}>
						{workout.description}
					</CardDescription>
				)}
			</CardHeader>
			<CardContent className="flex-grow">
				{workout.scheme && (
					<p className="text-xs text-muted-foreground">
						Scheme:{" "}
						<span className="font-medium text-foreground">
							{workout.scheme}
						</span>
					</p>
				)}
			</CardContent>
			<CardFooter>
				<Button
					onClick={() => onAddToTrackAction(workout.id)} // Updated to use renamed prop
					className="w-full"
					size="sm"
				>
					Add to Track
				</Button>
			</CardFooter>
		</Card>
	)
}
