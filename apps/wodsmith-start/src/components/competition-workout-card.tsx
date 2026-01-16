"use client"

import {
	Clock,
	Dumbbell,
	Maximize2,
	Target,
	Trophy,
    Timer,
    Flame,
    Hash,
    ArrowRight
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
    DialogDescription
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { DivisionDescription } from "@/server-fns/competition-workouts-fns"

interface CompetitionWorkoutCardProps {
	trackOrder: number
	name: string
	scheme: string // e.g. "time", "amrap", etc. from DB enum
	description: string | null // Default description
	scoreType: string | null
	roundsToScore: number | null
    tiebreakScheme?: string | null
	pointsMultiplier: number | null
	notes: string | null
	movements?: Array<{ id: string; name: string }>
	tags?: Array<{ id: string; name: string }>
	divisionDescriptions: DivisionDescription[]
	sponsorName?: string
	sponsorLogoUrl?: string | null
	selectedDivisionId?: string
    timeCap?: number | null // in seconds
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

function getSchemeLabel(scheme: string, timeCap?: number | null): string {
    if (scheme === 'time' || scheme === 'time-with-cap') {
        return timeCap ? 'For Time (Capped)' : 'For Time'
    }
    if (scheme === 'amrap') return 'AMRAP'
    if (scheme === 'emom') return 'EMOM'
    if (scheme === 'load') return 'For Load'
    return scheme.replace(/-/g, ' ').toUpperCase()
}

export function CompetitionWorkoutCard({
	trackOrder,
	name,
	scheme,
	description,
	scoreType,
    roundsToScore,
    tiebreakScheme,
	pointsMultiplier,
	notes,
	movements,
	tags,
	divisionDescriptions,
	sponsorName,
	sponsorLogoUrl,
	selectedDivisionId,
    timeCap
}: CompetitionWorkoutCardProps) {
	// Find RX division (position 0 is typically RX/hardest)
    const sortedDivisions = [...divisionDescriptions].sort(
		(a, b) => a.position - b.position,
	)
	const rxDivision = sortedDivisions.find((d) => d.position === 0)
	const rxDescription = rxDivision?.description

	// Determine description to display
    // If selectedDivisionId is provided (and not "default"), try to find that specific description.
    // If not found, fallback to RX description, then base description.
    const targetDivisionDesc = selectedDivisionId && selectedDivisionId !== "default"
        ? divisionDescriptions.find(d => d.divisionId === selectedDivisionId)
        : null
    
    const displayDescription = targetDivisionDesc?.description || rxDescription || description

    const formattedTimeCap = timeCap ? formatTime(timeCap) : null

    const schemeLabel = getSchemeLabel(scheme, timeCap)

	return (
		<Card className="overflow-hidden border-l-4 border-l-primary/40 hover:border-l-primary transition-all">
            <div className="flex flex-col md:flex-row">
                {/* Hero Number & Header Section */}
                <div className="flex-1 p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-start gap-4">
                            <span className="text-6xl font-black text-primary/20 leading-none select-none -ml-1">
                                {trackOrder.toString().padStart(2, '0')}
                            </span>
                            <div className="pt-1">
                                <h3 className="text-2xl font-bold tracking-tight">{name}</h3>
                                {sponsorName && (
                                    <div className="flex items-center gap-2 mt-1">
                                        {sponsorLogoUrl && (
                                            <img src={sponsorLogoUrl} alt={sponsorName} className="h-6 w-auto object-contain" />
                                        )}
                                        {!sponsorLogoUrl && (
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                Presented by {sponsorName}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Focus Mode Button */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
                                    <Maximize2 className="h-5 w-5" />
                                    <span className="sr-only">Expand workout</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl flex items-center gap-3">
                                        <span className="text-primary/40 font-black">#{trackOrder}</span>
                                        {name}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {schemeLabel}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="mt-6 space-y-6">
                                    {/* Specs in Modal */}
                                    <div className="flex flex-wrap gap-3">
                                        {formattedTimeCap && (
                                            <Badge variant="outline" className={cn("px-3 py-1 text-sm flex gap-2 items-center", scheme === 'time-with-cap' && "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400")}>
                                                <Clock className="h-4 w-4" />
                                                {formattedTimeCap} Cap
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="px-3 py-1 text-sm flex gap-2 items-center">
                                            <Target className="h-4 w-4" />
                                            {schemeLabel}
                                        </Badge>
                                        {scoreType && (
                                            <Badge variant="outline" className="px-3 py-1 text-sm flex gap-2 items-center">
                                                <Trophy className="h-4 w-4" />
                                                Score: {scoreType}
                                            </Badge>
                                        )}
                                        {roundsToScore && roundsToScore > 1 && (
                                            <Badge variant="outline" className="px-3 py-1 text-sm flex gap-2 items-center">
                                                <Hash className="h-4 w-4" />
                                                {roundsToScore} Rounds
                                            </Badge>
                                        )}
                                        {tiebreakScheme && (
                                            <Badge variant="outline" className="px-3 py-1 text-sm flex gap-2 items-center">
                                                <ArrowRight className="h-4 w-4" />
                                                Tiebreak: {tiebreakScheme}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="grid md:grid-cols-3 gap-8">
                                        {/* Movements List */}
                                        <div className="md:col-span-1 space-y-4">
                                            <h4 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                                                <Dumbbell className="h-4 w-4" />
                                                Ingredients
                                            </h4>
                                            {movements && movements.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {movements.map(m => (
                                                        <li key={m.id} className="text-sm font-medium border-b pb-2 last:border-0">
                                                            {m.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">No specific movements listed.</p>
                                            )}
                                        </div>

                                        {/* Workout Flow */}
                                        <div className="md:col-span-2 space-y-4">
                                            <h4 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                                                <Flame className="h-4 w-4" />
                                                The Work
                                            </h4>
                                            <div className="bg-muted/30 rounded-lg p-6 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                                                {displayDescription || "Details coming soon."}
                                            </div>
                                            {notes && (
                                                <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-md p-4 text-sm mt-4">
                                                    <strong className="font-semibold block mb-1">Notes</strong>
                                                    {notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Specs Row */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        {formattedTimeCap && (
                            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border", 
                                scheme === 'time-with-cap' 
                                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900" 
                                    : "bg-secondary text-secondary-foreground border-transparent"
                            )}>
                                <Timer className="h-4 w-4" />
                                {formattedTimeCap} Cap
                            </div>
                        )}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
                            <Target className="h-4 w-4" />
                            {schemeLabel}
                        </div>
                        {pointsMultiplier && pointsMultiplier !== 100 && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900">
                                <Trophy className="h-4 w-4" />
                                {pointsMultiplier}pts
                            </div>
                        )}
                        {roundsToScore && roundsToScore > 1 && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
                                <Hash className="h-4 w-4" />
                                {roundsToScore} Rounds
                            </div>
                        )}
                         {/* Placeholder for Division Tag if strictly needed, but context is global now */}
                         {/* {targetDivisionDesc && (
                             <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-muted text-muted-foreground border">
                                 {targetDivisionDesc.divisionLabel}
                             </div>
                         )} */}
                    </div>

                    {/* Content Grid */}
                    <div className="grid md:grid-cols-12 gap-6">
                         {/* Description - Takes up majority */}
                         <div className="md:col-span-8">
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <p className="whitespace-pre-wrap text-base leading-relaxed">
                                    {displayDescription || <span className="italic text-muted-foreground">Details to be announced.</span>}
                                </p>
                            </div>
                         </div>

                         {/* Side Panel for Movements ("Ingredients") */}
                         <div className="md:col-span-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                            {movements && movements.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                        <Dumbbell className="h-3.5 w-3.5" />
                                        Movements
                                    </h4>
                                    <ul className="space-y-2">
                                        {movements.map(m => (
                                            <li key={m.id} className="text-sm font-medium text-foreground/90 flex items-center justify-between">
                                                {m.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            
                            {tags && tags.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Tags</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {tags.map(tag => (
                                            <Badge key={tag.id} variant="secondary" className="text-xs font-normal">
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                         </div>
                    </div>
                    
                    {/* Footer / Notes */}
                    {notes && (
                        <div className="mt-6 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">Notes:</span> {notes}
                            </p>
                        </div>
                    )}
                </div>
            </div>
		</Card>
	)
}
