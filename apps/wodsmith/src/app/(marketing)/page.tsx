import type { Metadata } from "next"
import { InsightsFeatures } from "@/components/landing/insights-features"
import { MissionHero } from "@/components/landing/mission-hero"
import { ProductCards } from "@/components/landing/product-cards"
import { SITE_NAME } from "@/constants"

export const metadata: Metadata = {
	title: SITE_NAME,
	description:
		"Tools for the functional fitness community. Track your training. Run your competitions. Get insights that matter.",
}

export default function Home() {
	return (
		<main>
			<MissionHero />
			<ProductCards />
			<InsightsFeatures />
			{/* <SocialProof /> */}
		</main>
	)
}
