"use client"

import { Link } from "@tanstack/react-router"
import {
	ArrowRight,
	Bell,
	Calculator,
	Check,
	ClipboardCheck,
	FileText,
	Filter,
	Trophy,
	Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SessionValidationResult } from "@/types"

const athleteFeatures = [
	{
		icon: Filter,
		title: "My Division view",
		description:
			"See only your division's workouts and heats. No hunting through dropdowns.",
		available: true,
	},
	{
		icon: Bell,
		title: "Push notifications",
		description:
			"Get alerts 60, 30, and 10 minutes before your heat. Know when your lane changes.",
		available: false,
		label: "Coming soon",
	},
	{
		icon: Calculator,
		title: "Tie-breaker transparency",
		description:
			"See the math behind your ranking. Tie-breaker values are displayed.",
		available: true,
		labelNote: "Full explanations coming",
	},
]

const organizerFeatures = [
	{
		icon: ClipboardCheck,
		title: "Score verification",
		description:
			"Validation checks catch common mistakes. Publish controls per event/division.",
		available: true,
		labelNote: "Photo evidence coming",
	},
	{
		icon: Users,
		title: "Judge scheduling",
		description:
			"Assign judges by availability with conflict detection. Rotation patterns built in.",
		available: true,
		labelNote: "Verified credentials coming",
	},
	{
		icon: FileText,
		title: "Audit trail",
		description:
			"Track who entered, edited, and verified scores. Complete history of changes.",
		available: false,
		label: "Coming soon",
	},
]

interface TwoAudiencesProps {
	session: SessionValidationResult
}

export function TwoAudiences({ session }: TwoAudiencesProps) {
	const isLoggedIn = !!session?.user

	return (
		<section id="audiences" className="bg-background py-20">
			<div className="container mx-auto px-4">
				<div className="mx-auto mb-16 max-w-3xl text-center">
					<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
						Built for athletes. Built for organizers.
					</h2>
					<p className="text-lg text-muted-foreground">
						Different needs, same platform. Here's what each of you gets.
					</p>
				</div>

				<div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
					{/* Athletes */}
					<div className="rounded-2xl border border-border bg-card p-8">
						<div className="mb-6 flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
								<Trophy className="h-6 w-6 text-primary" />
							</div>
							<div>
								<span className="font-bold text-sm uppercase tracking-wider text-primary">
									For Athletes
								</span>
								<h3 className="font-mono text-2xl font-bold">
									Compete with confidence
								</h3>
							</div>
						</div>

						<div className="space-y-6">
							{athleteFeatures.map((feature) => (
								<div key={feature.title} className="flex gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
										<feature.icon className="h-5 w-5 text-foreground" />
									</div>
									<div className="flex-1">
										<div className="mb-1 flex items-center gap-2">
											<h4 className="font-semibold">{feature.title}</h4>
											{feature.available ? (
												<Check className="h-4 w-4 text-green-600" />
											) : (
												<Badge variant="secondary" className="text-xs">
													{feature.label}
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground">
											{feature.description}
										</p>
										{feature.labelNote && (
											<p className="mt-1 text-xs text-muted-foreground/70 italic">
												{feature.labelNote}
											</p>
										)}
									</div>
								</div>
							))}
						</div>

						<div className="mt-8 pt-6 border-t border-border">
							<Button variant="outline" className="w-full" asChild>
								<Link to="/compete">
									Browse Competitions
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>

					{/* Organizers */}
					<div className="rounded-2xl border border-foreground/20 bg-foreground p-8 text-background dark:border-border dark:bg-card dark:text-foreground">
						<div className="mb-6 flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-xl border border-background/20 bg-background/10 dark:border-border dark:bg-secondary">
								<Users className="h-6 w-6" />
							</div>
							<div>
								<span className="font-bold text-sm uppercase tracking-wider text-amber-500">
									For Organizers
								</span>
								<h3 className="font-mono text-2xl font-bold">
									Run smooth operations
								</h3>
							</div>
						</div>

						<div className="space-y-6">
							{organizerFeatures.map((feature) => (
								<div key={feature.title} className="flex gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-background/20 bg-background/10 dark:border-border dark:bg-secondary">
										<feature.icon className="h-5 w-5" />
									</div>
									<div className="flex-1">
										<div className="mb-1 flex items-center gap-2">
											<h4 className="font-semibold">{feature.title}</h4>
											{feature.available ? (
												<Check className="h-4 w-4 text-green-500" />
											) : (
												<Badge
													variant="secondary"
													className="text-xs bg-background/20 text-background dark:bg-secondary dark:text-foreground"
												>
													{feature.label}
												</Badge>
											)}
										</div>
										<p className="text-sm text-background/70 dark:text-muted-foreground">
											{feature.description}
										</p>
										{feature.labelNote && (
											<p className="mt-1 text-xs text-background/50 dark:text-muted-foreground/70 italic">
												{feature.labelNote}
											</p>
										)}
									</div>
								</div>
							))}
						</div>

						<div className="mt-8 pt-6 border-t border-background/20 dark:border-border">
							<Button
								className="w-full bg-background text-foreground hover:bg-background/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
								asChild
							>
								<Link
									to={
										isLoggedIn
											? "/compete/organizer"
											: "/compete/organizer/onboard"
									}
								>
									Host Your Competition
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
