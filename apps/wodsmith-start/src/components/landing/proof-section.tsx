import { Quote, Users } from "lucide-react"

const testimonials = [
	{
		quote:
			"The backend ops are the real problem. Payment is table stakes. WODsmith gets that.",
		name: "Basile",
		title: "Verdant CrossFit",
		event: "Multi-location comp organizer",
	},
	{
		quote:
			"I need my athletes to find their heats without hunting through 50 division dropdowns. That's the baseline.",
		name: "Jon",
		title: "All Valley Open",
		event: "Annual regional competition",
	},
	{
		quote:
			"When you're running 70+ gyms simultaneously, reliability is #1. I can't have the leaderboard go down mid-event.",
		name: "Will",
		title: "Fortitude Series",
		event: "Multi-gym throwdown series",
	},
]

export function ProofSection() {
	return (
		<section id="proof" className="border-y border-border bg-secondary py-20">
			<div className="container mx-auto px-4">
				<div className="mx-auto max-w-5xl">
					<div className="mb-12 text-center">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
							<Users className="h-4 w-4" />
							<span className="font-medium text-sm">Built With Organizers</span>
						</div>

						<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
							What comp organizers are saying
						</h2>

						<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
							WODsmith was built alongside real organizers running real events.
							These are their words.
						</p>
					</div>

					{/* Testimonials grid */}
					<div className="grid gap-8 md:grid-cols-3">
						{testimonials.map((testimonial) => (
							<div
								key={testimonial.name}
								className="relative rounded-xl border border-border bg-card p-6"
							>
								<Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" />

								<blockquote className="mb-6 text-lg leading-relaxed">
									"{testimonial.quote}"
								</blockquote>

								<div className="border-t border-border pt-4">
									<div className="font-semibold">{testimonial.name}</div>
									<div className="text-sm text-muted-foreground">
										{testimonial.title}
									</div>
									<div className="text-xs text-muted-foreground/70">
										{testimonial.event}
									</div>
								</div>
							</div>
						))}
					</div>

					{/* Social proof note */}
					<div className="mt-12 text-center">
						<p className="text-muted-foreground">
							Building your first comp on WODsmith?{" "}
							<span className="font-medium text-foreground">
								We offer concierge onboarding for your first event.
							</span>
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
