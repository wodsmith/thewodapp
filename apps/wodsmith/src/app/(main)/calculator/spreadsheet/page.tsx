import type { Metadata } from "next"
import { Suspense } from "react"
import SpreadsheetCalculator from "./_components/spreadsheet-calculator"

export const metadata: Metadata = {
	title: "Percentage Calculator",
	description: "Calculate percentages for your one-rep max training.",
	openGraph: {
		type: "website",
		title: "Percentage Calculator",
		description: "Calculate percentages for your one-rep max training.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Percentage Calculator")}`,
				width: 1200,
				height: 630,
				alt: "Percentage Calculator",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Percentage Calculator",
		description: "Calculate percentages for your one-rep max training.",
		images: [`/api/og?title=${encodeURIComponent("Percentage Calculator")}`],
	},
}

export default function SpreadsheetPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<SpreadsheetCalculator />
		</Suspense>
	)
}
