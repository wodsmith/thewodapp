import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
	getCompetition,
	getUserCompetitionRegistration,
} from "@/server/competitions"
import { parseCompetitionSettings } from "@/types/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { RegistrationForm } from "./_components/registration-form"
import { scalingGroupsTable, userTable } from "@/db/schema"
import { getDb } from "@/db"
import { eq } from "drizzle-orm"

type Props = {
	params: Promise<{ slug: string }>
	searchParams: Promise<{ canceled?: string }>
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
		title: `Register for ${competition.name}`,
		description: `Register for ${competition.name} competition`,
	}
}

export default async function RegisterPage({ params, searchParams }: Props) {
	const { slug } = await params
	const { canceled } = await searchParams

	// Get competition first (needed for redirect)
	const competition = await getCompetition(slug)
	if (!competition) {
		notFound()
	}

	const session = await getSessionFromCookie()
	if (!session) {
		redirect(`/sign-in?redirect=/compete/${slug}/register`)
	}

	// Check if already registered
	const existingRegistration = await getUserCompetitionRegistration(
		competition.id,
		session.userId,
	)
	if (existingRegistration) {
		redirect(`/compete/${slug}`)
	}

	// Check profile completeness
	// if (!session.user.gender || !session.user.dateOfBirth) {
	// 	redirect(`/compete/profile?redirect=/compete/${slug}/register`)
	// }

	// Check registration window
	const now = new Date()
	const regOpensAt = competition.registrationOpensAt
		? typeof competition.registrationOpensAt === "number"
			? new Date(competition.registrationOpensAt)
			: competition.registrationOpensAt
		: null
	const regClosesAt = competition.registrationClosesAt
		? typeof competition.registrationClosesAt === "number"
			? new Date(competition.registrationClosesAt)
			: competition.registrationClosesAt
		: null

	const registrationOpen = !!(
		regOpensAt &&
		regClosesAt &&
		regOpensAt <= now &&
		regClosesAt >= now
	)

	// Get competition settings for divisions
	const settings = parseCompetitionSettings(competition.settings)
	if (!settings?.divisions?.scalingGroupId) {
		// No divisions configured
		return (
			<div className="mx-auto max-w-2xl">
				<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
					<h1 className="text-2xl font-bold mb-2">
						Registration Not Available
					</h1>
					<p>This competition does not have divisions configured yet.</p>
				</div>
			</div>
		)
	}

	// Get scaling group and levels for divisions

	const db = getDb()
	const scalingGroup = await db.query.scalingGroupsTable.findFirst({
		where: eq(scalingGroupsTable.id, settings.divisions.scalingGroupId),
		with: {
			scalingLevels: {
				orderBy: (table, { asc }) => [asc(table.position)],
			},
		},
	})

	if (
		!scalingGroup ||
		!scalingGroup.scalingLevels ||
		scalingGroup.scalingLevels.length === 0
	) {
		return (
			<div className="mx-auto max-w-2xl">
				<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
					<h1 className="text-2xl font-bold mb-2">
						Registration Not Available
					</h1>
					<p>This competition's divisions are not properly configured.</p>
				</div>
			</div>
		)
	}

	// Fetch user's affiliate from their profile
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, session.userId),
		columns: { affiliateName: true },
	})

	return (
		<div className="mx-auto max-w-2xl">
			<RegistrationForm
				competition={competition}
				scalingGroup={scalingGroup}
				userId={session.userId}
				registrationOpen={registrationOpen}
				registrationOpensAt={regOpensAt}
				registrationClosesAt={regClosesAt}
				paymentCanceled={canceled === "true"}
				defaultAffiliateName={user?.affiliateName ?? undefined}
			/>
		</div>
	)
}
