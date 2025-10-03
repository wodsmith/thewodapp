import type { Metadata } from "next"
import BarbellCalculator from "./_components/barbell-calculator"

export const metadata: Metadata = {
	title: "Barbell Calculator",
	description: "Calculate barbell loading for your workouts.",
	openGraph: {
		type: "website",
		title: "Barbell Calculator",
		description: "Calculate barbell loading for your workouts.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Barbell Calculator")}`,
				width: 1200,
				height: 630,
				alt: "Barbell Calculator",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Barbell Calculator",
		description: "Calculate barbell loading for your workouts.",
		images: [`/api/og?title=${encodeURIComponent("Barbell Calculator")}`],
	},
}

export default function CalculatorPage() {
	return <BarbellCalculator />
}
