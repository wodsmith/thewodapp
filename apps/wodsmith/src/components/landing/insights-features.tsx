import {
	BoltIcon,
	ChartBarIcon,
	DevicePhoneMobileIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"

const features = [
	{
		name: "Flexible Scoring",
		description:
			"Log For Time, AMRAP, EMOM, max lifts, and more. Track sets, reps, weights, and tiebreaks the way your gym programs.",
		icon: ChartBarIcon,
	},
	{
		name: "Team Management",
		description:
			"Create your gym team, manage member roles and permissions, and organize programming for your athletes.",
		icon: UserGroupIcon,
	},
	{
		name: "Programming Tracks",
		description:
			"Build programming schedules, assign workouts to specific days, and let athletes follow along with their gym's plan.",
		icon: BoltIcon,
	},
	{
		name: "Responsive Design",
		description:
			"Works on your phone at the gym or your computer at home. Dark mode included for late night programming.",
		icon: DevicePhoneMobileIcon,
	},
]

export function InsightsFeatures() {
	return (
		<section id="features" className="bg-background py-24">
			<div className="container mx-auto px-4">
				{/* Section header */}
				<div className="mx-auto mb-16 max-w-2xl text-center">
					<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
						Built for How You Train
					</h2>
					<p className="text-lg text-muted-foreground">
						WODsmith understands functional fitness workouts and gives you the
						tools to log them properly.
					</p>
				</div>

				{/* Features grid */}
				<div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
					{features.map((feature) => (
						<div key={feature.name} className="group relative">
							<div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
								<feature.icon className="h-6 w-6" aria-hidden="true" />
							</div>
							<h3 className="mb-2 font-mono text-lg font-semibold">
								{feature.name}
							</h3>
							<p className="text-muted-foreground">{feature.description}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

export default InsightsFeatures
