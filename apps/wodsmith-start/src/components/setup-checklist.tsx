"use client"

import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	Check,
	ChevronDown,
	ChevronUp,
	Circle,
	ExternalLink,
	ListChecks,
	X,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ONBOARDING_KEYS } from "@/db/schemas/onboarding"
import type { ChecklistStatus } from "@/server-fns/checklist-fns"
import { updateOnboardingStateFn } from "@/server-fns/onboarding-fns"
import { useOnboardingStore } from "@/state/onboarding"
import { cn } from "@/utils/cn"

interface ChecklistItem {
	id: string
	label: string
	description: string
	completed: boolean
	href: string
	/** If true, this step is pre-checked (e.g., "Create competition") */
	preChecked?: boolean
}

interface SetupChecklistProps {
	competitionId: string
	teamId: string
	checklistStatus: ChecklistStatus
	competitionSlug: string
}

export function SetupChecklist({
	competitionId,
	teamId,
	checklistStatus,
	competitionSlug,
}: SetupChecklistProps) {
	const [isOpen, setIsOpen] = useState(true)
	const { isCompleted, setCompleted } = useOnboardingStore()
	const updateOnboarding = useServerFn(updateOnboardingStateFn)

	const isDismissed = isCompleted(ONBOARDING_KEYS.CHECKLIST_DISMISSED)
	const hasPreviewedPublicPage = isCompleted(
		ONBOARDING_KEYS.CHECKLIST_PREVIEW_PUBLIC_PAGE,
	)

	const basePath = `/compete/organizer/${competitionId}`

	const items: ChecklistItem[] = [
		{
			id: "create",
			label: "Create competition",
			description: "You've already created your competition!",
			completed: true,
			preChecked: true,
			href: basePath,
		},
		{
			id: "details",
			label: "Edit competition details",
			description: "Add a description, dates, and banner image",
			completed: checklistStatus.hasCompetitionDetails,
			href: `${basePath}/edit`,
		},
		{
			id: "divisions",
			label: "Add divisions",
			description: "Create divisions like RX, Scaled, etc.",
			completed: checklistStatus.hasDivisions,
			href: `${basePath}/divisions`,
		},
		{
			id: "events",
			label: "Add events/workouts",
			description: "Add the workouts athletes will compete in",
			completed: checklistStatus.hasEvents,
			href: `${basePath}/events`,
		},
		{
			id: "scoring",
			label: "Configure scoring",
			description: "Set up how athletes are ranked and scored",
			completed: checklistStatus.hasScoringConfig,
			href: `${basePath}/scoring`,
		},
		{
			id: "registration",
			label: "Set up registration & pricing",
			description: "Configure registration window and fees",
			completed: checklistStatus.hasRegistrationConfig,
			href: `${basePath}/pricing`,
		},
		{
			id: "waivers",
			label: "Add waivers",
			description: "Create liability waivers for athletes to sign",
			completed: checklistStatus.hasWaivers,
			href: `${basePath}/waivers`,
		},
		{
			id: "preview",
			label: "Preview your public page",
			description: "See what athletes will see when they visit",
			completed: hasPreviewedPublicPage,
			href: `/compete/${competitionSlug}`,
		},
		{
			id: "publish",
			label: "Publish competition",
			description: "Make your competition visible to athletes",
			completed: checklistStatus.isPublished,
			href: `${basePath}/edit`,
		},
	]

	const completedCount = items.filter((item) => item.completed).length
	const totalCount = items.length
	const progressPercent = Math.round((completedCount / totalCount) * 100)

	const handleDismiss = async () => {
		setCompleted(ONBOARDING_KEYS.CHECKLIST_DISMISSED, true)
		await updateOnboarding({
			data: {
				teamId,
				competitionId,
				key: ONBOARDING_KEYS.CHECKLIST_DISMISSED,
				completed: true,
			},
		})
	}

	const handleRestore = async () => {
		setCompleted(ONBOARDING_KEYS.CHECKLIST_DISMISSED, false)
		await updateOnboarding({
			data: {
				teamId,
				competitionId,
				key: ONBOARDING_KEYS.CHECKLIST_DISMISSED,
				completed: false,
			},
		})
	}

	const handlePreviewClick = async () => {
		if (!hasPreviewedPublicPage) {
			setCompleted(ONBOARDING_KEYS.CHECKLIST_PREVIEW_PUBLIC_PAGE, true)
			await updateOnboarding({
				data: {
					teamId,
					competitionId,
					key: ONBOARDING_KEYS.CHECKLIST_PREVIEW_PUBLIC_PAGE,
					completed: true,
				},
			})
		}
	}

	// Show a minimal "Show checklist" button when dismissed
	if (isDismissed) {
		return (
			<button
				type="button"
				onClick={handleRestore}
				className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ListChecks className="h-4 w-4" />
				<span>
					Show setup checklist ({completedCount}/{totalCount})
				</span>
			</button>
		)
	}

	return (
		<Card>
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<ListChecks className="h-5 w-5 text-primary" />
							<div>
								<CardTitle className="text-base">Setup Checklist</CardTitle>
								<p className="text-sm text-muted-foreground mt-0.5">
									{completedCount} of {totalCount} steps completed
								</p>
							</div>
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleDismiss}
								className="h-8 w-8 p-0 text-muted-foreground"
							>
								<X className="h-4 w-4" />
								<span className="sr-only">Dismiss checklist</span>
							</Button>
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-8 p-0 text-muted-foreground"
								>
									{isOpen ? (
										<ChevronUp className="h-4 w-4" />
									) : (
										<ChevronDown className="h-4 w-4" />
									)}
									<span className="sr-only">
										{isOpen ? "Collapse" : "Expand"} checklist
									</span>
								</Button>
							</CollapsibleTrigger>
						</div>
					</div>

					{/* Progress bar */}
					<div className="mt-3 h-2 w-full rounded-full bg-muted">
						<div
							className="h-2 rounded-full bg-primary transition-all duration-300"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				</CardHeader>

				<CollapsibleContent>
					<CardContent className="pt-0">
						<ul className="space-y-1">
							{items.map((item) => (
								<li key={item.id}>
									{item.id === "preview" ? (
										<a
											href={item.href}
											target="_blank"
											rel="noopener noreferrer"
											onClick={handlePreviewClick}
											className={cn(
												"flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
												item.completed && "text-muted-foreground",
											)}
										>
											<ChecklistIcon completed={item.completed} />
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-1.5">
													<span
														className={cn(
															"font-medium",
															item.completed && "line-through",
														)}
													>
														{item.label}
													</span>
													<ExternalLink className="h-3 w-3 shrink-0" />
												</div>
												{!item.completed && (
													<p className="text-xs text-muted-foreground mt-0.5">
														{item.description}
													</p>
												)}
											</div>
										</a>
									) : (
										<Link
											to={item.href}
											className={cn(
												"flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
												item.completed && "text-muted-foreground",
											)}
										>
											<ChecklistIcon completed={item.completed} />
											<div className="flex-1 min-w-0">
												<span
													className={cn(
														"font-medium",
														item.completed && "line-through",
													)}
												>
													{item.label}
												</span>
												{!item.completed && (
													<p className="text-xs text-muted-foreground mt-0.5">
														{item.description}
													</p>
												)}
											</div>
										</Link>
									)}
								</li>
							))}
						</ul>
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	)
}

function ChecklistIcon({ completed }: { completed: boolean }) {
	if (completed) {
		return (
			<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
				<Check className="h-3 w-3" />
			</div>
		)
	}
	return <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" />
}
