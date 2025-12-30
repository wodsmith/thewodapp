"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SessionValidationResult } from "@/types"

interface MissionHeroProps {
	session: SessionValidationResult
}

export function MissionHero({ session }: MissionHeroProps) {
	const isLoggedIn = !!session?.user

	return (
		<section className="relative overflow-hidden bg-background py-20 md:py-32">
			{/* Abstract background elements */}
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-secondary blur-3xl" />
			</div>

			<div className="container mx-auto px-4 text-center">
				{/* Badge */}
				<div className="mb-8 inline-flex items-center rounded-full border border-border bg-secondary px-4 py-1.5 font-medium text-sm">
					<span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-primary" />
					The platform for functional fitness
				</div>

				{/* Headline */}
				<h1 className="mb-6 font-mono text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-balance">
					Tools Built for <br className="hidden md:block" />
					<span className="text-primary">Functional Fitness</span>
				</h1>

				{/* Subheadline */}
				<p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl text-balance">
					Log your workouts. Follow your gym's programming. Run your
					competitions. WODsmith helps you track and organize the work you put
					in.
				</p>

				{/* CTAs */}
				<div className="flex flex-col justify-center gap-4 sm:flex-row">
					<Button size="lg" asChild>
						<Link to={isLoggedIn ? "/workouts" : "/sign-up"}>
							{isLoggedIn ? "Go to Workouts" : "Start Tracking Free"}
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
					<Button
						variant="outline"
						size="lg"
						onClick={() => {
							document
								.getElementById("products")
								?.scrollIntoView({ behavior: "smooth" })
						}}
					>
						Explore Products
					</Button>
				</div>
			</div>
		</section>
	)
}

export default MissionHero
