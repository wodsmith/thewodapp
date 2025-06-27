import {
	BoltIcon,
	ChartBarIcon,
	ClockIcon,
	DevicePhoneMobileIcon,
	TrophyIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"

export const Features = () => {
	const features = [
		{
			icon: ChartBarIcon,
			title: "TRACK EVERYTHING",
			description:
				"Log weights, reps, time, distance. Whatever you lift, we track it.",
			highlighted: true,
		},
		{
			icon: ClockIcon,
			title: "LIGHTNING FAST",
			description: "Get in, log your workout, get out. No BS, no distractions.",
			highlighted: false,
		},
		{
			icon: UserGroupIcon,
			title: "COMMUNITY DRIVEN",
			description:
				"Share workouts, compete with friends, celebrate your wins together.",
			highlighted: false,
		},
		{
			icon: DevicePhoneMobileIcon,
			title: "MOBILE FIRST",
			description:
				"Built for your phone. Works offline. Always in your pocket.",
			highlighted: true,
		},
		{
			icon: BoltIcon,
			title: "SMART INSIGHTS",
			description:
				"See your progress, identify patterns, break through plateaus.",
			highlighted: false,
		},
		{
			icon: TrophyIcon,
			title: "ACHIEVEMENT SYSTEM",
			description:
				"Unlock badges, hit milestones, gamify your fitness journey.",
			highlighted: false,
		},
	]

	return (
		<section id="features" className="bg-secondary py-20">
			<div className="container mx-auto px-4">
				<div className="text-center mb-16">
					<h2 className="font-mono text-4xl md:text-6xl text-primary mb-6">
						FEATURES THAT
						<br />
						<span className="text-orange">ACTUALLY MATTER</span>
					</h2>
					<p className="font-sans text-xl text-primary max-w-2xl mx-auto">
						We cut the fluff and kept what works. Here&apos;s why 50,000+
						athletes choose TheWodApp over everything else.
					</p>
				</div>

				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
					{features.map((feature, _index) => (
						<div
							key={feature.title}
							className="bg-background border-4 border-primary p-8 hover:shadow-[8px_8px_0px_0px] hover:shadow-primary transition-all duration-300 hover:-translate-x-2 hover:-translate-y-2"
						>
							<div
								className={`w-16 h-16 ${
									feature.highlighted ? "bg-orange" : "bg-primary-foreground"
								} border-2 border-primary rounded-lg flex items-center justify-center mb-6`}
							>
								<feature.icon className="text-primary" />
							</div>

							<h3 className="font-mono text-2xl text-primary mb-4">
								{feature.title}
							</h3>

							<p className="font-sans text-primary leading-relaxed">
								{feature.description}
							</p>
						</div>
					))}
				</div>

				<div className="text-center mt-16">
					<div className="bg-primary border-4 border-primary p-8 inline-block">
						<p className="font-sans text-xl text-primary-foreground mb-4">
							&quot;TheWodApp helped me add 50lbs to my deadlift in 3 months.
							The progress tracking is insane!&quot;
						</p>
						<div className="font-mono text-lg text-orange">
							- SARAH K., CROSSFIT ATHLETE
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default Features
