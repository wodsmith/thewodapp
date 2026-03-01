import { createFileRoute } from "@tanstack/react-router"
import { Footer } from "@/components/footer"
import { CompeteHero } from "@/components/landing/compete-hero"
import { DisasterPrevention } from "@/components/landing/disaster-prevention"
import { FinalCTA } from "@/components/landing/final-cta"
import { PainStrip } from "@/components/landing/pain-strip"
import { SeriesTeaser } from "@/components/landing/series-teaser"
import { TwoAudiences } from "@/components/landing/two-audiences"
import { VolunteerScheduling } from "@/components/landing/volunteer-scheduling"

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{
				title: "WODsmith Compete - Run comps athletes trust",
			},
			{
				name: "description",
				content:
					"Run functional fitness competitions without spreadsheet ops. Score verification, transparent tie-breakers, volunteer scheduling, and digital appeals. Built with organizers running multi-location series.",
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
				{/* 1. Hero - Primary promise with villain */}
				<CompeteHero session={session} />

				{/* 2. Pain strip - Real quotes from organizers/athletes */}
				<PainStrip />

				{/* 3. Two audiences - Athlete and Organizer value props */}
				<TwoAudiences session={session} />

				{/* 4. Disaster prevention - How we prevent comp-day failures */}
				<DisasterPrevention />

				{/* 5. Volunteer/judge scheduling - Kill the spreadsheets */}
				<VolunteerScheduling />

				{/* 6. Series teaser - Multi-location capability */}
				<SeriesTeaser />

				{/* 7. Reliability - Uptime and resilience */}
				{/* <ReliabilitySection /> */}

				{/* 8. Proof - Testimonials and endorsements */}
				{/* <ProofSection /> */}

				{/* 9. FAQ - Common questions */}
				{/* <FAQSection /> */}

				{/* 10. Final CTA - Repeat primary conversion */}
				<FinalCTA session={session} />
			</main>
			<Footer />
		</>
	)
}
