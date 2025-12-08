import {
	ArrowRightIcon,
	BoltIcon,
	CheckIcon,
	TrophyIcon,
} from "@heroicons/react/24/outline"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const athleteFeatures = [
	"Log any workout type (For Time, AMRAP, EMOM, max lifts)",
	"Follow your gym's programming or create your own",
	"Track scores with scaling levels (RX, Scaled)",
	"View workout history and leaderboards",
]

const organizerFeatures = [
	"Heat scheduling with venues and lane assignments",
	"Score entry and leaderboards by division",
	"Athlete registration with Stripe payments",
	"Track registration revenue and platform fees",
]

export function ProductCards() {
	return (
		<section id="products" className="border-y border-border bg-secondary py-20">
			<div className="container mx-auto px-4">
				{/* Section header */}
				<div className="mx-auto mb-16 max-w-3xl text-center">
					<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
						One Platform, Two Powerful Tools
					</h2>
					<p className="text-lg text-muted-foreground">
						Whether you are chasing a new PR or hosting the next big throwdown,
						we have the specialized tools you need.
					</p>
				</div>

				{/* Product cards grid */}
				<div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
					{/* Athletes Card */}
					<div className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:border-primary/50 hover:shadow-xl">
						{/* Background icon */}
						<div className="pointer-events-none absolute top-0 right-0 p-6 opacity-5 transition-opacity group-hover:opacity-10">
							<BoltIcon className="h-32 w-32 text-primary" />
						</div>

						{/* Icon */}
						<div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<BoltIcon className="h-7 w-7" />
						</div>

						{/* Label */}
						<span className="mb-2 font-bold text-sm uppercase tracking-wider text-primary">
							For Athletes & Coaches
						</span>

						{/* Title */}
						<h3 className="font-mono text-3xl font-bold">WODsmith Track</h3>

						{/* Description */}
						<p className="mt-3 text-lg text-muted-foreground">
							Log your workouts, track your scores, and follow your gym's
							programming schedule.
						</p>

						<hr className="my-8 border-border" />

						{/* Features list */}
						<ul className="flex-1 space-y-4">
							{athleteFeatures.map((feature) => (
								<li key={feature} className="flex items-start">
									<CheckIcon className="mr-3 h-5 w-5 shrink-0 text-primary" />
									<span>{feature}</span>
								</li>
							))}
						</ul>

						{/* CTA */}
						<div className="mt-10 pt-4">
							<Button className="group/btn w-full" size="lg" asChild>
								<Link href="/sign-up">
									Start Tracking Free
									<ArrowRightIcon className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
								</Link>
							</Button>
						</div>
					</div>

					{/* Organizers Card - Dark theme */}
					<div className="group relative flex flex-col rounded-2xl border border-foreground/20 bg-foreground p-8 text-background shadow-xl transition-all hover:border-foreground/40 hover:shadow-2xl dark:border-border dark:bg-card dark:text-foreground">
						{/* Background icon */}
						<div className="pointer-events-none absolute top-0 right-0 p-6 opacity-5 transition-opacity group-hover:opacity-10">
							<TrophyIcon className="h-32 w-32" />
						</div>

						{/* Icon */}
						<div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-background/20 bg-background/10 dark:border-border dark:bg-secondary">
							<TrophyIcon className="h-7 w-7" />
						</div>

						{/* Label */}
						<span className="mb-2 font-bold text-sm uppercase tracking-wider text-amber-500">
							For Competition Organizers
						</span>

						{/* Title */}
						<h3 className="font-mono text-3xl font-bold">WODsmith Compete</h3>

						{/* Description */}
						<p className="mt-3 text-lg text-background/70 dark:text-muted-foreground">
							Efficiency in planning, accuracy in game day operations, and ease
							of use for athletes.
						</p>

						<hr className="my-8 border-background/20 dark:border-border" />

						{/* Features list */}
						<ul className="flex-1 space-y-4">
							{organizerFeatures.map((feature) => (
								<li key={feature} className="flex items-start">
									<div className="mr-3 mt-0.5 rounded-full bg-amber-500/10 p-1">
										<CheckIcon className="h-3 w-3 shrink-0 text-amber-500" />
									</div>
									<span className="text-background/90 dark:text-foreground">
										{feature}
									</span>
								</li>
							))}
						</ul>

						{/* CTA */}
						<div className="mt-10 pt-4">
							<Button
								variant="secondary"
								className="group/btn w-full bg-background text-foreground hover:bg-background/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
								size="lg"
								asChild
							>
								<Link href="/compete/organizer">
									Host Your Competition
									<ArrowRightIcon className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default ProductCards
