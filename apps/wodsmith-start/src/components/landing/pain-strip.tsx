import {
	AlertTriangle,
	FileSpreadsheet,
	MessageSquareX,
	Search,
} from "lucide-react"

const painPoints = [
	{
		icon: AlertTriangle,
		quote: "I placed 8th when I was actually 2nd. A typo decided my podium.",
		pain: "Score entry typos",
	},
	{
		icon: MessageSquareX,
		quote:
			"Paper appeals get lost. Email threads go nowhere. No one explains the decision.",
		pain: "Broken appeals",
	},
	{
		icon: Search,
		quote: "50+ divisions in a dropdown. Just tell me my heat and my workout.",
		pain: "Heat discovery chaos",
	},
	{
		icon: FileSpreadsheet,
		quote:
			"I run volunteer scheduling on Google Docs. Printed spreadsheets everywhere.",
		pain: "Spreadsheet ops",
	},
]

export function PainStrip() {
	return (
		<section
			id="pain-points"
			className="border-y border-border bg-secondary py-16"
		>
			<div className="container mx-auto px-4">
				<div className="mx-auto max-w-5xl">
					<h2 className="mb-2 text-center font-mono text-2xl font-bold tracking-tight sm:text-3xl">
						Sound familiar?
					</h2>
					<p className="mb-12 text-center text-muted-foreground">
						These are real problems from real comp organizers and athletes.
					</p>

					<div className="grid gap-6 md:grid-cols-2">
						{painPoints.map((point) => (
							<div
								key={point.pain}
								className="relative rounded-xl border border-border bg-card p-6 shadow-sm"
							>
								<div className="mb-4 flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
										<point.icon className="h-5 w-5 text-destructive" />
									</div>
									<span className="font-medium text-sm uppercase tracking-wider text-destructive">
										{point.pain}
									</span>
								</div>
								<blockquote className="text-lg italic text-muted-foreground">
									"{point.quote}"
								</blockquote>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}
