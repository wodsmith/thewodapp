import {
	ChartBarIcon,
	BoltIcon,
	DevicePhoneMobileIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"

const features = [
	{
		name: "Data That Matters",
		description:
			"Don't just log weights. See your volume trends, strength curves, and metabolic conditioning improvements over time.",
		icon: ChartBarIcon,
	},
	{
		name: "Community Built",
		description:
			"Create teams, share workouts, and compete on leaderboards with your gym buddies or remote training partners.",
		icon: UserGroupIcon,
	},
	{
		name: "Zero Friction Logging",
		description:
			"We know you're tired. Our interface is designed to let you log complex WODs quickly so you can recover.",
		icon: BoltIcon,
	},
	{
		name: "Access Anywhere",
		description:
			"Mobile optimized for the gym floor, desktop optimized for coaches planning the programming.",
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
						Insights Beyond the Whiteboard
					</h2>
					<p className="text-lg text-muted-foreground">
						WODsmith supports the functional fitness community with purpose-built
						tools designed to make your hard work visible.
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
