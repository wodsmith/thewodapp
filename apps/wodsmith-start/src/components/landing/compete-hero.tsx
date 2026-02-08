"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SessionValidationResult } from "@/types"

interface CompeteHeroProps {
	session: SessionValidationResult
}

export function CompeteHero({ session }: CompeteHeroProps) {
	const isLoggedIn = !!session?.user

	return (
		<section className="relative overflow-hidden bg-background py-20 md:py-32">
			{/* Abstract background elements */}
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-3xl" />
			</div>

			<div className="container mx-auto px-4 text-center">
				{/* Proof nugget - visible above the fold */}
				<div className="mb-8 inline-flex items-center rounded-full border border-border bg-secondary px-4 py-1.5 font-medium text-sm">
					<span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-amber-500" />
					Built with comp organizers running multi-location series
				</div>

				{/* Headline - names the villain */}
				<h1 className="my-12 font-mono text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-balance">
					Run a smooth competition
					<br className="hidden md:block" />
					<span className="text-primary">without spreadsheet ops</span>
				</h1>

				{/* Subheadline - the promise */}
				<p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl text-balance">
					No more volunteer scheduling chaos. WODsmith Compete handles the backend
					nightmare so you can focus on what matters.
				</p>

				{/* CTAs */}
				<div className="flex flex-col justify-center gap-4 sm:flex-row">
					<Button size="lg" asChild>
						<Link
							to={
								isLoggedIn ? "/compete/organizer" : "/compete/organizer/onboard"
							}
						>
							Request Access
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
					<Button
						variant="outline"
						size="lg"
						onClick={() => {
							document
								.getElementById("pain-points")
								?.scrollIntoView({ behavior: "smooth" })
						}}
					>
						See How It Works
					</Button>
				</div>

				{/* Friction clarifier */}
				<p className="mt-4 text-sm text-muted-foreground">
					No credit card required. Platform fee applies to paid registrations.
				</p>
			</div>
		</section>
	)
}
