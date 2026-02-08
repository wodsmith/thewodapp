import {
	AlertTriangle,
	ArrowRight,
	Award,
	Calendar,
	Check,
	RefreshCw,
	UserCheck,
	Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

const schedulingFeatures = [
	{
		icon: Calendar,
		title: "Availability intake",
		description:
			"Volunteers specify morning/afternoon preferences and experience level.",
		available: true,
	},
	{
		icon: UserCheck,
		title: "Assign to heats",
		description:
			"Match judges to heats based on availability. Filter by role and credential.",
		available: true,
	},
	{
		icon: RefreshCw,
		title: "Rotation patterns",
		description:
			"Built-in rotation logic so judges don't work the same lane all day.",
		available: true,
	},
	{
		icon: AlertTriangle,
		title: "Conflict detection",
		description:
			"Automatic alerts when a judge is double-booked or unavailable.",
		available: true,
	},
]

const comingFeatures = [
	{
		icon: Award,
		title: "Verified credentials",
		description:
			"Structured credential capture (L1, L2, etc.) with verification status.",
	},
	{
		icon: Users,
		title: "Role enforcement",
		description: "Fine-grain controls based on volunteer assigned roles.",
	},
]

export function VolunteerScheduling() {
	return (
		<section id="scheduling" className="bg-background py-20">
			<div className="container mx-auto px-4">
				<div className="mx-auto max-w-6xl">
					<div className="grid gap-12 lg:grid-cols-2 lg:items-center">
						{/* Content */}
						<div>
							<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-amber-700 dark:text-amber-400">
								<Users className="h-4 w-4" />
								<span className="font-medium text-sm">Staff Management</span>
							</div>

							<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
								Volunteer & judge scheduling that isn't spreadsheets
							</h2>

							<p className="mb-8 text-lg text-muted-foreground">
								Stop managing volunteers in Google Docs. Assign judges to heats,
								handle rotations, and catch conflicts before game day.
							</p>

							{/* Available now */}
							<div className="space-y-4">
								{schedulingFeatures.map((feature) => (
									<div key={feature.title} className="flex items-start gap-3">
										<div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/10">
											<Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
										</div>
										<div>
											<span className="font-medium">{feature.title}</span>
											<span className="text-muted-foreground">
												{" "}
												— {feature.description}
											</span>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Coming soon card */}
						<div className="rounded-2xl border border-border bg-secondary p-8">
							<div className="mb-6 flex items-center gap-2">
								<Badge variant="secondary">Coming soon</Badge>
								<span className="text-sm text-muted-foreground">
									Based on organizer feedback
								</span>
							</div>

							<div className="space-y-6">
								{comingFeatures.map((feature) => (
									<div key={feature.title} className="flex gap-4">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
											<feature.icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
										</div>
										<div>
											<h4 className="font-semibold">{feature.title}</h4>
											<p className="text-sm text-muted-foreground">
												{feature.description}
											</p>
										</div>
									</div>
								))}
							</div>

							<div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
								<ArrowRight className="h-4 w-4" />
								<span>Viewable/exportable schedules available now</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
