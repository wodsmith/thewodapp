import {
	ArrowRightIcon,
	BoltIcon,
	TagIcon,
	TrophyIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@tanstack/react-router"
import { Button } from "~/components/ui/button"

export const Hero = () => {
	return (
		<section className="bg-background min-h-[90vh] flex items-center relative overflow-hidden">
			{/* Background geometric shapes */}
			<div className="absolute inset-0">
				<div className="absolute top-20 right-20 w-32 h-32 bg-primary transform rotate-12 hidden lg:block" />
				<div className="absolute bottom-20 left-20 w-24 h-24 bg-secondary transform -rotate-12 hidden lg:block" />
				<div className="absolute top-1/2 right-1/3 w-16 h-16 bg-accent border-4 border-primary transform rotate-45 hidden lg:block" />
			</div>

			<div className="container mx-auto px-4 py-16 relative">
				<div className="grid lg:grid-cols-2 gap-12 items-center">
					<div>
						<div className="flex items-center space-x-2 mb-6">
							<div className="flex space-x-1">
								<BoltIcon className="text-primary" />
								<TagIcon className="text-primary" />
								<TrophyIcon className="text-primary" />
							</div>
							<span className="font-sans font-semibold text-primary bg-secondary px-3 py-1 border-2 border-primary">
								#1 Workout Tracker
							</span>
						</div>

						<h1 className="font-mono text-4xl md:text-6xl lg:text-7xl text-primary leading-tight mb-6">
							TRACK YOUR
							<br />
							<span className="text-primary">WORKOUTS</span>
							<br />
							LIKE A BEAST
						</h1>

						<p className="font-sans text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
							Stop overthinking your fitness journey. TheWodApp is the brutally
							simple workout tracker that helps you{" "}
							<strong>crush your goals</strong> without the fluff.
						</p>

						<div className="flex flex-col sm:flex-row gap-4 mb-8">
							<Button size="lg" asChild>
								<Link href="/sign-up">
									START TRACKING FREE
									<ArrowRightIcon className="ml-2" />
								</Link>
							</Button>

							<Button variant="outline" size="lg" asChild>
								<a
									href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
									target="_blank"
									rel="noreferrer"
								>
									WATCH DEMO
								</a>
							</Button>
						</div>

						<div className="flex items-center space-x-8 text-foreground">
							<div className="text-center">
								<div className="font-mono text-3xl">50K+</div>
								<div className="font-sans text-sm">ATHLETES</div>
							</div>
							<div className="w-px h-12 bg-border" />
							<div className="text-center">
								<div className="font-mono text-3xl">1M+</div>
								<div className="font-sans text-sm">WORKOUTS</div>
							</div>
							<div className="w-px h-12 bg-border" />
							<div className="text-center">
								<div className="font-mono text-3xl text-primary">4.9★</div>
								<div className="font-sans text-sm">RATING</div>
							</div>
						</div>
					</div>

					<div className="relative">
						{/* Mock phone/app preview */}
						<div className="bg-primary border-4 border-primary rounded-3xl p-4 max-w-sm mx-auto shadow-[12px_12px_0px_0px] shadow-accent">
							<div className="bg-background rounded-2xl p-6 h-96 flex flex-col">
								<div className="flex justify-between items-center mb-6">
									<div className="font-mono text-lg text-primary">
										TODAY'S WOD
									</div>
									<div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
								</div>

								<div className="space-y-4 flex-1">
									<div className="bg-secondary border-2 border-primary p-3 rounded-lg">
										<div className="font-mono text-sm text-primary">
											DEADLIFTS
										</div>
										<div className="font-sans text-xs text-primary">
											5 SETS × 5 REPS
										</div>
									</div>

									<div className="bg-accent border-2 border-primary p-3 rounded-lg">
										<div className="font-mono text-sm text-primary">SQUATS</div>
										<div className="font-sans text-xs text-primary">
											3 SETS × 10 REPS
										</div>
									</div>

									<div className="bg-secondary border-2 border-primary p-3 rounded-lg">
										<div className="font-mono text-sm text-primary">
											PULL-UPS
										</div>
										<div className="font-sans text-xs text-primary">
											4 SETS × 8 REPS
										</div>
									</div>
								</div>

								<Button className="w-full bg-primary border-2 border-border font-mono text-primary-foreground mt-4">
									START WORKOUT
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default Hero
