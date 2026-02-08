import { Building2, Globe, Settings, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const seriesFeatures = [
	{
		icon: Settings,
		title: "One config, many venues",
		description:
			"Set up your competition once. Roll it out to 70+ gyms with controlled overrides.",
	},
	{
		icon: Globe,
		title: "Global leaderboard",
		description:
			"Aggregated results across all locations with per-venue breakdowns.",
	},
	{
		icon: Building2,
		title: "Venue management",
		description:
			"Assign gyms to locations. Set capacity, timezone, and local schedule constraints.",
	},
]

export function SeriesTeaser() {
	return (
		<section
			id="series"
			className="border-y border-border bg-foreground py-20 text-background dark:bg-secondary dark:text-foreground"
		>
			<div className="container mx-auto px-4">
				<div className="mx-auto max-w-5xl">
					<div className="mb-12 text-center">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-background/10 px-4 py-2 dark:bg-background">
							<Trophy className="h-4 w-4 text-amber-500" />
							<span className="font-medium text-sm text-amber-500">
								Multi-Location Series
							</span>
						</div>

						<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
							Running a series across multiple gyms?
						</h2>

						<p className="mx-auto max-w-2xl text-lg text-background/70 dark:text-muted-foreground">
							Whether it's a regional qualifier or a nationwide throwdown,
							Series mode gives you unified configuration and global results.
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-3">
						{seriesFeatures.map((feature) => (
							<div
								key={feature.title}
								className="rounded-xl border border-background/20 bg-background/5 p-6 dark:border-border dark:bg-card"
							>
								<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
									<feature.icon className="h-5 w-5 text-amber-500" />
								</div>
								<h3 className="mb-2 font-mono text-lg font-semibold">
									{feature.title}
								</h3>
								<p className="text-sm text-background/70 dark:text-muted-foreground">
									{feature.description}
								</p>
							</div>
						))}
					</div>

					<div className="mt-12 text-center">
						<Badge
							variant="secondary"
							className="bg-background/20 text-background dark:bg-secondary dark:text-foreground"
						>
							Phase 2
						</Badge>
						<p className="mt-2 text-sm text-background/50 dark:text-muted-foreground">
							Full series mode coming after MVP. Contact us for early access.
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
