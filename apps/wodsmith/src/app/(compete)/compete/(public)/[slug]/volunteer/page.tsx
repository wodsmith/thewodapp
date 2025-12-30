import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { VolunteerSignupForm } from "./_components/volunteer-signup-form"

type Props = {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `Volunteer for ${competition.name}`,
		description: `Sign up to volunteer at ${competition.name}`,
		openGraph: {
			title: `Volunteer for ${competition.name}`,
			description: `Sign up to volunteer at ${competition.name}`,
			images: [
				{
					url: `/api/og/competition?slug=${encodeURIComponent(slug)}`,
					width: 1200,
					height: 630,
					alt: competition.name,
				},
			],
		},
	}
}

/**
 * Public volunteer sign-up page
 * No authentication required - anyone can sign up to volunteer
 */
export default async function VolunteerSignupPage({ params }: Props) {
	const { slug } = await params

	const competition = await getCompetition(slug)
	if (!competition) {
		notFound()
	}

	// Check if competition has a team (required for volunteer signups)
	if (!competition.competitionTeamId) {
		return (
			<div className="mx-auto max-w-2xl">
				<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
					<h1 className="text-2xl font-bold mb-2">
						Volunteer Sign-up Not Available
					</h1>
					<p>
						This competition is not accepting volunteer sign-ups at this time.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-2xl py-8 px-4">
			<VolunteerSignupForm
				competition={competition}
				competitionTeamId={competition.competitionTeamId}
			/>
		</div>
	)
}
