import BarbellCalculator from "./_components/barbell-calculator"

import type { Metadata } from "next"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "WODsmith - Calculator",
	description: "Track your spicy workouts and progress.",
	openGraph: {
		title: "WODsmith - Calculator", // Default title for layout
		description: "Track your spicy workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("WODsmith - Calculator")}`,
				width: 1200,
				height: 630,
				alt: "WODsmith - Calculator",
			},
		],
	},
}

export default function CalculatorPage() {
	return <BarbellCalculator />
}
