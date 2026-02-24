import {
	AlertCircle,
	ArrowRight,
	Calculator,
	CheckCircle2,
	FileCheck,
	History,
	MessageSquare,
	Shield,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

const preventionFeatures = [
	{
		icon: FileCheck,
		title: "Score verification before publish",
		description:
			"Validation checks catch typos, out-of-range values, and duplicates before they hit the leaderboard.",
		painSolved: "Typos deciding podiums",
		available: true,
		coming: "Scorecard photo evidence",
	},
	{
		icon: History,
		title: "Complete audit trail",
		description:
			"Every score entry, edit, and verification is logged. See who changed what, when, and why.",
		painSolved: "Hidden changes",
		available: false,
		label: "Coming soon",
	},
	{
		icon: Calculator,
		title: "Transparent scoring",
		description:
			"Tie-breaker values displayed clearly. Athletes see the computed values that determine their rank.",
		painSolved: "Opaque rankings",
		available: true,
		coming: "Full breakdown explanations",
	},
	{
		icon: MessageSquare,
		title: "Volunteer Schedule",
		description:
			"Each Volunteer will have their schedule emailed to them, when updates occur they will be notified immediately.",
		painSolved: "Schedule confusion",
		available: true,
		label: "Coming soon",
	},
]

export function DisasterPrevention() {
	return (
		<section id="trust" className="border-y border-border bg-secondary py-20">
			<div className="container mx-auto px-4">
				<div className="mx-auto mb-16 max-w-3xl text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-green-700 dark:text-green-400">
						<Shield className="h-4 w-4" />
						<span className="font-medium text-sm">Trust & Transparency</span>
					</div>
					<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
						How we prevent comp-day disasters
					</h2>
					<p className="text-lg text-muted-foreground">
						Every feature exists because something went wrong at a real
						competition. Here's how we stop it from happening again.
					</p>
				</div>

				<div className="mx-auto max-w-5xl">
					<div className="grid gap-6 md:grid-cols-2">
						{preventionFeatures.map((feature) => (
							<div
								key={feature.title}
								className="group relative rounded-xl border border-border bg-card p-6 transition-all hover:border-green-500/50 hover:shadow-lg"
							>
								{/* Status indicator */}
								<div className="absolute top-4 right-4">
									{feature.available ? (
										<div className="flex items-center gap-1 text-green-600 dark:text-green-400">
											<CheckCircle2 className="h-4 w-4" />
											<span className="text-xs font-medium">Available</span>
										</div>
									) : (
										<Badge variant="secondary" className="text-xs">
											{feature.label}
										</Badge>
									)}
								</div>

								{/* Icon */}
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
									<feature.icon className="h-6 w-6" />
								</div>

								{/* Pain solved */}
								<div className="mb-2 flex items-center gap-2">
									<AlertCircle className="h-3 w-3 text-destructive" />
									<span className="text-xs font-medium uppercase tracking-wider text-destructive">
										Solves: {feature.painSolved}
									</span>
								</div>

								{/* Content */}
								<h3 className="mb-2 font-mono text-lg font-semibold">
									{feature.title}
								</h3>
								<p className="text-muted-foreground">{feature.description}</p>

								{/* Coming enhancement */}
								{feature.coming && (
									<div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground/70">
										<ArrowRight className="h-3 w-3" />
										<span className="italic">Next: {feature.coming}</span>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}
