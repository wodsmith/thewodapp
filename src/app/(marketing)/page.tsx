import { Features } from "@/components/landing/features"
import { Hero } from "@/components/landing/hero"
import Pricing from "@/components/landing/pricing"
import { SITE_DESCRIPTION, SITE_NAME } from "@/constants"
import type { Metadata } from "next"

export const metadata: Metadata = {
	title: SITE_NAME,
	description: SITE_DESCRIPTION,
}

export default function Home() {
	return (
		<main>
			<Hero />
			<Features />
			<Pricing />
		</main>
	)
}
