import { Activity, Globe, HelpCircle, Server, Wifi } from "lucide-react"

const reliabilityPoints = [
	{
		icon: Globe,
		title: "Edge-deployed globally",
		description:
			"Built on Cloudflare Workers. Your data is served from the location closest to you.",
	},
	{
		icon: Activity,
		title: "99.9%+ uptime target",
		description:
			"Monitored during event windows. We know when something breaks before you do.",
	},
	{
		icon: Wifi,
		title: "Graceful degradation",
		description:
			"Venue wifi spotty? Submissions queue locally until connection is restored.",
	},
]

const faqItems = [
	{
		question: "What happens if the platform goes down during my event?",
		answer:
			"We maintain a status page and have an incident response playbook. You'll get real-time updates and we have rollback plans ready.",
	},
	{
		question: "How do you handle venue connectivity issues?",
		answer:
			"Score submissions can buffer locally when connection drops. Data syncs automatically when connectivity returns.",
	},
]

export function ReliabilitySection() {
	return (
		<section id="reliability" className="bg-background py-20">
			<div className="container mx-auto px-4">
				<div className="mx-auto max-w-5xl">
					<div className="mb-12 text-center">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-2 text-blue-700 dark:text-blue-400">
							<Server className="h-4 w-4" />
							<span className="font-medium text-sm">Reliability</span>
						</div>

						<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
							When the platform fails, the event fails
						</h2>

						<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
							We treat reliability as a feature, not an afterthought. Here's
							what we promise.
						</p>
					</div>

					{/* Reliability points */}
					<div className="mb-16 grid gap-8 md:grid-cols-3">
						{reliabilityPoints.map((point) => (
							<div
								key={point.title}
								className="rounded-xl border border-border bg-card p-6 text-center"
							>
								<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
									<point.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
								</div>
								<h3 className="mb-2 font-mono text-lg font-semibold">
									{point.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{point.description}
								</p>
							</div>
						))}
					</div>

					{/* Mini FAQ */}
					<div className="rounded-2xl border border-border bg-secondary p-8">
						<div className="mb-6 flex items-center gap-2">
							<HelpCircle className="h-5 w-5 text-muted-foreground" />
							<span className="font-semibold">What happens if...</span>
						</div>

						<div className="space-y-6">
							{faqItems.map((item) => (
								<div key={item.question}>
									<h4 className="mb-2 font-medium">{item.question}</h4>
									<p className="text-muted-foreground">{item.answer}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
