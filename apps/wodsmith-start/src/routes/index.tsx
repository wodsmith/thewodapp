import { createFileRoute } from "@tanstack/react-router"
import { InsightsFeatures } from "@/components/landing/insights-features"
import { MissionHero } from "@/components/landing/mission-hero"
import { ProductCards } from "@/components/landing/product-cards"
import { Footer } from "@/components/footer"

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{
				title: "WODsmith - Tools Built for Functional Fitness",
			},
			{
				name: "description",
				content:
					"Tools for the functional fitness community. Track your training. Run your competitions. Get insights that matter.",
			},
		],
	}),
	component: HomePage,
})

function HomePage() {
	const { session } = Route.useRouteContext()

	return (
		<>
			<main>
				<MissionHero session={session} />
				<ProductCards session={session} />
				<InsightsFeatures />
				{/* <SocialProof /> */}
			</main>
			<Footer />
		</>
	)
}
