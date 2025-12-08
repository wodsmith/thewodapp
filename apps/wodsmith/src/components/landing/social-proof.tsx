import { StarIcon } from "@heroicons/react/24/solid"

const testimonials = [
	{
		quote:
			"Finally, a tracker that gets functional fitness. I can log AMRAPs, For Time workouts, and lifts the way they're actually programmed instead of forcing everything into sets and reps.",
		author: "Sarah J.",
		role: "CrossFit Athlete",
		initials: "SJ",
	},
	{
		quote:
			"The heat scheduling alone made our throwdown run smoother. Athletes could see their heat times, and we could enter scores and update the leaderboard without scrambling.",
		author: "Mike R.",
		role: "Gym Owner & Organizer",
		initials: "MR",
	},
]

function StarRating() {
	return (
		<div className="mb-4 flex gap-1">
			{[...Array(5)].map((_, i) => (
				<StarIcon key={i} className="h-4 w-4 text-amber-400" />
			))}
		</div>
	)
}

export function SocialProof() {
	return (
		<section className="border-t border-border bg-secondary py-20">
			<div className="container mx-auto px-4">
				<div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
					{testimonials.map((testimonial) => (
						<div
							key={testimonial.author}
							className="rounded-2xl border border-border bg-card p-8 shadow-sm"
						>
							<StarRating />
							<p className="mb-6 text-lg font-medium leading-relaxed">
								"{testimonial.quote}"
							</p>
							<div className="flex items-center">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold text-muted-foreground text-xs">
									{testimonial.initials}
								</div>
								<div className="ml-3">
									<div className="font-semibold">{testimonial.author}</div>
									<div className="text-muted-foreground text-sm">
										{testimonial.role}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

export default SocialProof
