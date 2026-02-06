"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRight, Dumbbell, Target, Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	return `${m}:${s.toString().padStart(2, "0")}`
}

function getSchemeLabel(scheme: string, timeCap?: number | null): string {
	if (scheme === "time" || scheme === "time-with-cap") {
		return timeCap ? "For Time (Capped)" : "For Time"
	}
	if (scheme === "amrap") return "AMRAP"
	if (scheme === "emom") return "EMOM"
	if (scheme === "load") return "For Load"
	return scheme.replace(/-/g, " ").toUpperCase()
}

interface WorkoutPreviewProps {
	name: string
	description: string | null
	scheme: string
	timeCap: number | null
	movements: Array<{ id: string; name: string }>
	tags: Array<{ id: string; name: string }>
	eventDetailUrl: { slug: string; eventId: string }
	isLoading: boolean
	divisionScale?: string | null
	divisionLabel?: string | null
}

export function WorkoutPreview({
	name,
	description,
	scheme,
	timeCap,
	movements,
	tags,
	eventDetailUrl,
	isLoading,
	divisionScale,
	divisionLabel,
}: WorkoutPreviewProps) {
	if (isLoading) {
		return (
			<div className="space-y-3 p-4 rounded-lg border bg-muted/30">
				<Skeleton className="h-6 w-48" />
				<div className="flex gap-2">
					<Skeleton className="h-5 w-20" />
					<Skeleton className="h-5 w-16" />
				</div>
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-4 w-64" />
			</div>
		)
	}

	const schemeLabel = getSchemeLabel(scheme, timeCap)
	const formattedTimeCap = timeCap ? formatTime(timeCap) : null

	return (
		<div className="space-y-3 p-4 rounded-lg border bg-muted/30">
			<div className="flex items-start justify-between gap-4">
				<h3 className="text-lg font-bold tracking-tight">{name}</h3>
				<Button variant="outline" size="sm" asChild className="shrink-0">
					<Link to="/compete/$slug/workouts/$eventId" params={eventDetailUrl}>
						View Full Details
						<ArrowRight className="ml-1.5 h-3.5 w-3.5" />
					</Link>
				</Button>
			</div>

			<div className="flex flex-wrap gap-2">
				<div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
					<Target className="h-3 w-3" />
					{schemeLabel}
				</div>
				{formattedTimeCap && (
					<div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
						<Timer className="h-3 w-3" />
						{formattedTimeCap} Cap
					</div>
				)}
				{tags.map((tag) => (
					<Badge
						key={tag.id}
						variant="secondary"
						className="text-xs font-normal"
					>
						{tag.name}
					</Badge>
				))}
			</div>

			{description && (
				<div className="font-mono text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
					{description}
				</div>
			)}

			{divisionScale && (
				<div className="border-t pt-3 mt-1">
					<div className="flex items-start gap-2">
						<Badge variant="secondary" className="shrink-0 text-xs font-medium">
							{divisionLabel || "Division"}
						</Badge>
						<p className="font-mono text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
							{divisionScale}
						</p>
					</div>
				</div>
			)}

			{movements.length > 0 && (
				<div className="flex items-start gap-2 text-sm text-muted-foreground">
					<Dumbbell className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>{movements.map((m) => m.name).join(", ")}</span>
				</div>
			)}
		</div>
	)
}
