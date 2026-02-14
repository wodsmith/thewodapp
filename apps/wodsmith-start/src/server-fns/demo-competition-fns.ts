/**
 * Demo Competition Server Functions
 * Handles generation, listing, and deletion of demo competitions for client demos
 *
 * This file uses top-level imports for server-only modules.
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, like } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	commerceProductTable,
	commercePurchaseTable,
	competitionDivisionsTable,
} from "@/db/schemas/commerce"
import {
	createAddressId,
	createCommerceProductId,
	createCommercePurchaseId,
	createCompetitionHeatAssignmentId,
	createCompetitionHeatId,
	createCompetitionRegistrationId,
	createCompetitionVenueId,
	createHeatVolunteerId,
	createJudgeAssignmentVersionId,
	createJudgeRotationId,
	createProgrammingTrackId,
	createScalingGroupId,
	createScalingLevelId,
	createSponsorId,
	createTeamId,
	createTeamMembershipId,
	createTrackWorkoutId,
	createUserId,
	createWorkoutScalingDescriptionId,
} from "@/db/schemas/common"
import { addressesTable } from "@/db/schemas/addresses"
import {
	competitionHeatAssignmentsTable,
	competitionHeatsTable,
	competitionRegistrationsTable,
	competitionsTable,
	competitionVenuesTable,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import {
	scalingGroupsTable,
	scalingLevelsTable,
	workoutScalingDescriptionsTable,
} from "@/db/schemas/scaling"
import { scoresTable, scoreRoundsTable } from "@/db/schemas/scores"
import { sponsorsTable } from "@/db/schemas/sponsors"
import { teamMembershipTable, teamTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import {
	competitionJudgeRotationsTable,
	judgeAssignmentVersionsTable,
	judgeHeatAssignmentsTable,
} from "@/db/schemas/volunteers"
import { waiversTable } from "@/db/schemas/waivers"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import {
	DEMO_DIVISIONS,
	DEMO_EMAIL_DOMAIN,
	DEMO_PRIMARY_ADDRESS,
	DEMO_SPONSORS,
	DEMO_WAIVER_CONTENT,
	DEMO_WORKOUTS,
	FEMALE_FIRST_NAMES,
	generateDemoEmail,
	generateLoadScore,
	generateTeamName,
	generateTimeScore,
	LAST_NAMES,
	MALE_FIRST_NAMES,
	shuffleArray,
} from "@/lib/demo-data"
import { computeSortKey, sortKeyToString } from "@/lib/scoring"
import { requireAdmin } from "@/utils/auth"
import { generateSlug } from "@/utils/slugify"
import { createCompetition } from "./competition-server-logic"

// ============================================================================
// Types
// ============================================================================

export interface DemoCompetitionSummary {
	id: string
	name: string
	slug: string
	startDate: string
	endDate: string
	registrationCount: number
	createdAt: Date
}

export interface GenerateDemoCompetitionResult {
	success: boolean
	competitionId: string
	competitionSlug: string
	summary: {
		divisionsCreated: number
		workoutsCreated: number
		registrationsCreated: number
		heatsCreated: number
		scoresCreated: number
		volunteersCreated: number
	}
}

interface DivisionResultsSchema {
	[eventId: string]: {
		[divisionId: string]: {
			publishedAt: number | null
		}
	}
}

interface CompetitionSettings {
	divisions?: { scalingGroupId: string }
	scoringAlgorithm?: string
	isDemo?: boolean
	demoUserIds?: string[]
	demoTeamIds?: string[]
	divisionResults?: DivisionResultsSchema
}

// ============================================================================
// Input Schemas
// ============================================================================

const generateDemoCompetitionInputSchema = z.object({
	name: z.string().min(1, "Competition name is required").max(255),
	organizingTeamId: z.string().optional(), // Optional - will create demo team if not provided
	competitionDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
	demoTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
})

const deleteDemoCompetitionInputSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create fake users for demo competition
 */
async function createFakeUsers(
	db: ReturnType<typeof getDb>,
	count: number,
	gender: "male" | "female",
	uniquePrefix: string,
): Promise<Array<{ id: string; firstName: string; lastName: string }>> {
	const firstNames =
		gender === "male"
			? shuffleArray(MALE_FIRST_NAMES)
			: shuffleArray(FEMALE_FIRST_NAMES)
	const lastNames = shuffleArray(LAST_NAMES)

	const users: Array<{ id: string; firstName: string; lastName: string }> = []
	const userInserts: Array<typeof userTable.$inferInsert> = []

	for (let i = 0; i < count; i++) {
		const firstName = firstNames[i % firstNames.length]!
		const lastName = lastNames[i % lastNames.length]!
		const uniqueId = `${uniquePrefix}${i}`
		const email = generateDemoEmail(firstName, lastName, uniqueId)
		const userId = createUserId()

		userInserts.push({
			id: userId,
			firstName,
			lastName,
			email,
			emailVerified: new Date(),
			gender,
			role: "user",
		})

		users.push({ id: userId, firstName, lastName })
	}

	if (userInserts.length > 0) {
		await db.insert(userTable).values(userInserts)
	}

	return users
}

/**
 * Create team memberships for users
 */
async function createTeamMemberships(
	db: ReturnType<typeof getDb>,
	userIds: string[],
	teamId: string,
	roleId: string,
	metadata?: string,
): Promise<string[]> {
	const membershipIds: string[] = []
	const membershipInserts: Array<typeof teamMembershipTable.$inferInsert> = []

	for (const userId of userIds) {
		const membershipId = createTeamMembershipId()
		membershipInserts.push({
			id: membershipId,
			teamId,
			userId,
			roleId,
			isSystemRole: true,
			joinedAt: new Date(),
			isActive: true,
			metadata,
		})
		membershipIds.push(membershipId)
	}

	if (membershipInserts.length > 0) {
		await db.insert(teamMembershipTable).values(membershipInserts)
	}

	return membershipIds
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Generate a demo competition with all related entities
 */
export const generateDemoCompetitionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		generateDemoCompetitionInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<GenerateDemoCompetitionResult> => {
		await requireAdmin()

		const db = getDb()
		const timestamp = Date.now()
		const uniquePrefix = `demo_${timestamp}_`

		// Track created entities for cleanup on failure
		const createdUserIds: string[] = []
		const createdTeamIds: string[] = []

		// Track if we patched an existing team's Stripe fields for rollback
		let stripePatched = false
		let originalStripeFields: {
			teamId: string
			stripeConnectedAccountId: string | null
			stripeAccountStatus: string | null
			stripeAccountType: string | null
			stripeOnboardingCompletedAt: Date | null
		} | null = null

		try {
			// 1. Get or create organizing team with Stripe Connect setup
			let organizingTeamId = data.organizingTeamId
			const demoStripeAccountId = `acct_demo_${createId().substring(0, 16)}`

			if (!organizingTeamId) {
				// Create a demo organizing team with Stripe Connect already set up
				const demoOrgTeamId = createTeamId()
				await db.insert(teamTable).values({
					id: demoOrgTeamId,
					name: `Demo Organizer - ${timestamp}`,
					slug: `demo-organizer-${timestamp}`,
					type: "gym",
					creditBalance: 0,
					// Stripe Connect setup for demo
					stripeConnectedAccountId: demoStripeAccountId,
					stripeAccountStatus: "VERIFIED",
					stripeAccountType: "express",
					stripeOnboardingCompletedAt: new Date(),
				})

				organizingTeamId = demoOrgTeamId
				createdTeamIds.push(organizingTeamId)
			} else {
				// Update existing team with Stripe Connect data if not already set
				const existingTeam = await db.query.teamTable.findFirst({
					where: eq(teamTable.id, organizingTeamId),
				})

				if (existingTeam && !existingTeam.stripeConnectedAccountId) {
					// Store original values for rollback on failure
					originalStripeFields = {
						teamId: organizingTeamId,
						stripeConnectedAccountId: existingTeam.stripeConnectedAccountId,
						stripeAccountStatus: existingTeam.stripeAccountStatus,
						stripeAccountType: existingTeam.stripeAccountType,
						stripeOnboardingCompletedAt:
							existingTeam.stripeOnboardingCompletedAt,
					}

					await db
						.update(teamTable)
						.set({
							stripeConnectedAccountId: demoStripeAccountId,
							stripeAccountStatus: "VERIFIED",
							stripeAccountType: "express",
							stripeOnboardingCompletedAt: new Date(),
						})
						.where(eq(teamTable.id, organizingTeamId))

					stripePatched = true
				}
			}

			if (!organizingTeamId) {
				throw new Error("Failed to resolve organizing team ID")
			}

			// 2. Create competition with unique slug
			let slug = generateSlug(data.name)
			let slugIsUnique = false
			let attempts = 0

			while (!slugIsUnique && attempts < 5) {
				const existing = await db.query.competitionsTable.findFirst({
					where: eq(competitionsTable.slug, slug),
				})

				if (!existing) {
					slugIsUnique = true
				} else {
					slug = `${generateSlug(data.name)}-${createId().substring(0, 4)}`
					attempts++
				}
			}

			// Single-day competition
			const { competitionId, competitionTeamId } = await createCompetition({
				organizingTeamId,
				name: data.name,
				slug,
				startDate: data.competitionDate,
				endDate: data.competitionDate,
				description: "Demo competition for client presentation",
			})

			// Parse demo time for event scheduling
			const demoDateTime = new Date(
				`${data.competitionDate}T${data.demoTime}:00`,
			)

			// Keep as draft/unpublished - organizer can publish when ready
			// Set up fee configuration for revenue demo
			// Create primary address for the competition
			const primaryAddressId = createAddressId()
			await db.insert(addressesTable).values({
				id: primaryAddressId,
				...DEMO_PRIMARY_ADDRESS,
			})

			await db
				.update(competitionsTable)
				.set({
					visibility: "public",
					// Default registration fee ($150 - individual divisions)
					defaultRegistrationFeeCents: 15000,
					// Use platform defaults for fees (2.5% + $2.00)
					platformFeePercentage: null,
					platformFeeFixed: null,
					// Pass platform fees to customer, organizer absorbs Stripe fees
					passPlatformFeesToCustomer: true,
					passStripeFeesToCustomer: false,
					// Link primary address
					primaryAddressId,
				})
				.where(eq(competitionsTable.id, competitionId))

			// 3. Create scaling group and divisions
			const scalingGroupId = createScalingGroupId()
			await db.insert(scalingGroupsTable).values({
				id: scalingGroupId,
				title: "Demo Competition Divisions",
				teamId: organizingTeamId,
				isDefault: false,
				isSystem: false,
			})

			const divisionIds: Record<string, string> = {}
			const divisionInserts: Array<typeof scalingLevelsTable.$inferInsert> = []
			const divisionFeeInserts: Array<
				typeof competitionDivisionsTable.$inferInsert
			> = []

			for (const division of DEMO_DIVISIONS) {
				const divisionId = createScalingLevelId()
				divisionIds[division.label] = divisionId

				divisionInserts.push({
					id: divisionId,
					scalingGroupId,
					label: division.label,
					position: division.position,
					teamSize: division.teamSize,
				})

				divisionFeeInserts.push({
					competitionId,
					divisionId,
					feeCents: division.feeCents,
					description: `${division.label} - ${division.teamSize === 1 ? "Individual" : "Team of 2"}`,
				})
			}

			await db.insert(scalingLevelsTable).values(divisionInserts)
			await db.insert(competitionDivisionsTable).values(divisionFeeInserts)

			// 4. Update competition settings with scaling group
			const settings: CompetitionSettings = {
				divisions: { scalingGroupId },
				scoringAlgorithm: "traditional",
				isDemo: true,
				demoUserIds: [],
				demoTeamIds: [],
			}

			// 5. Create programming track
			const trackId = createProgrammingTrackId()
			await db.insert(programmingTracksTable).values({
				id: trackId,
				name: `${data.name} Events`,
				type: "team_owned",
				ownerTeamId: organizingTeamId,
				competitionId,
				isPublic: 0,
			})

			// 6. Create workouts and track workouts
			const trackWorkoutIds: string[] = []
			const workoutIds: string[] = [] // Track workout IDs for scaling descriptions
			const sponsorIds: string[] = []

			// Create sponsors
			const sponsorInserts: Array<typeof sponsorsTable.$inferInsert> = []
			for (const sponsor of DEMO_SPONSORS) {
				const sponsorId = createSponsorId()
				sponsorIds.push(sponsorId)
				sponsorInserts.push({
					id: sponsorId,
					competitionId,
					name: sponsor.name,
					website: sponsor.website,
					displayOrder: sponsorIds.length - 1,
				})
			}
			if (sponsorInserts.length > 0) {
				await db.insert(sponsorsTable).values(sponsorInserts)
			}

			// Create workouts, track workouts, and scaling descriptions
			const workoutInserts: Array<typeof workoutsTable.$inferInsert> = []
			const trackWorkoutInserts: Array<typeof trackWorkoutsTable.$inferInsert> =
				[]
			const scalingDescInserts: Array<
				typeof workoutScalingDescriptionsTable.$inferInsert
			> = []

			for (let i = 0; i < DEMO_WORKOUTS.length; i++) {
				const template = DEMO_WORKOUTS[i]!
				const workoutId = `wkt_${createId()}`
				workoutIds.push(workoutId)

				workoutInserts.push({
					id: workoutId,
					name: template.name,
					description: template.description,
					scheme: template.scheme,
					scoreType: template.scoreType,
					timeCap: template.timeCap,
					tiebreakScheme: template.tiebreakScheme,
					repsPerRound: template.repsPerRound,
					roundsToScore: template.roundsToScore,
					scope: "private",
					teamId: organizingTeamId,
				})

				const trackWorkoutId = createTrackWorkoutId()
				trackWorkoutIds.push(trackWorkoutId)

				trackWorkoutInserts.push({
					id: trackWorkoutId,
					trackId,
					workoutId,
					trackOrder: i + 1,
					pointsMultiplier: 100,
					heatStatus: i < 2 ? "published" : "draft", // First 2 have heats
					eventStatus: "published",
					sponsorId: sponsorIds[i],
				})

				// Create workout scaling descriptions for each division
				for (const division of DEMO_DIVISIONS) {
					const divisionId = divisionIds[division.label]!
					const isTeam = division.teamSize > 1

					let scalingDescription =
						division.gender === "male"
							? template.maleScaling
							: template.femaleScaling

					if (isTeam && template.teamNotes && scalingDescription) {
						scalingDescription += `\n\n**Team Format:**\n${template.teamNotes}`
					}

					if (scalingDescription) {
						scalingDescInserts.push({
							id: createWorkoutScalingDescriptionId(),
							workoutId,
							scalingLevelId: divisionId,
							description: scalingDescription,
						})
					}
				}
			}

			await db.insert(workoutsTable).values(workoutInserts)
			await db.insert(trackWorkoutsTable).values(trackWorkoutInserts)
			if (scalingDescInserts.length > 0) {
				await db
					.insert(workoutScalingDescriptionsTable)
					.values(scalingDescInserts)
			}

			// 7. Create venue
			const venueId = createCompetitionVenueId()
			await db.insert(competitionVenuesTable).values({
				id: venueId,
				competitionId,
				name: "Main Floor",
				laneCount: 10,
				transitionMinutes: 3,
				sortOrder: 0,
			})

			// 8. Create fake users dynamically based on divisions
			// Configuration: athletes per individual division, teams per team division
			const ATHLETES_PER_INDIVIDUAL_DIVISION = 6
			const TEAMS_PER_TEAM_DIVISION = 4

			// Store users and teams by division for registration creation
			const divisionAthletes: Map<
				string,
				Array<{ id: string; firstName: string; lastName: string }>
			> = new Map()
			const divisionTeams: Map<
				string,
				Array<{
					teamId: string
					members: Array<{ id: string; firstName: string; lastName: string }>
				}>
			> = new Map()

			let divisionCounter = 0
			for (const division of DEMO_DIVISIONS) {
				const divisionId = divisionIds[division.label]!

				if (division.teamSize === 1) {
					// Individual division - create individual athletes
					const athletes = await createFakeUsers(
						db,
						ATHLETES_PER_INDIVIDUAL_DIVISION,
						division.gender,
						`${uniquePrefix}div${divisionCounter}_`,
					)
					createdUserIds.push(...athletes.map((u) => u.id))
					divisionAthletes.set(divisionId, athletes)
				} else {
					// Team division - create teams with members
					const teamCount = TEAMS_PER_TEAM_DIVISION
					const athletesNeeded = teamCount * division.teamSize
					// Alternate genders for mixed teams
					const athletes = await createFakeUsers(
						db,
						athletesNeeded,
						division.gender,
						`${uniquePrefix}div${divisionCounter}_`,
					)
					createdUserIds.push(...athletes.map((u) => u.id))

					// Group into teams
					const teams: Array<{
						teamId: string
						members: Array<{ id: string; firstName: string; lastName: string }>
					}> = []

					for (let t = 0; t < teamCount; t++) {
						const members = athletes.slice(
							t * division.teamSize,
							(t + 1) * division.teamSize,
						)

						const athleteTeamId = createTeamId()
						createdTeamIds.push(athleteTeamId)

						// Generate team name from member last names
						const teamName =
							members.length === 2
								? generateTeamName(members[0]!.lastName, members[1]!.lastName)
								: `Team ${members[0]!.lastName}`

						await db.insert(teamTable).values({
							id: athleteTeamId,
							name: teamName,
							slug: `demo-team-${timestamp}-div${divisionCounter}-${t}`,
							type: "competition_team",
							parentOrganizationId: competitionTeamId,
							creditBalance: 0,
						})

						// Add members to the athlete team
						await createTeamMemberships(
							db,
							members.map((m) => m.id),
							athleteTeamId,
							"member",
						)

						teams.push({ teamId: athleteTeamId, members })
					}

					divisionTeams.set(divisionId, teams)
				}
				divisionCounter++
			}

			// 9. Create team memberships (add all athletes to competition_event team)
			await createTeamMemberships(
				db,
				createdUserIds,
				competitionTeamId,
				"member",
			)

			// 10. Get team membership IDs for registrations
			const membershipMap = new Map<string, string>()
			const memberships = await db.query.teamMembershipTable.findMany({
				where: eq(teamMembershipTable.teamId, competitionTeamId),
			})
			for (const m of memberships) {
				membershipMap.set(m.userId, m.id)
			}

			// 11. Create registrations for all divisions
			const registrationIds: Array<{
				id: string
				divisionId: string
				userId: string
			}> = []
			const registrationInserts: Array<
				typeof competitionRegistrationsTable.$inferInsert
			> = []

			for (const division of DEMO_DIVISIONS) {
				const divisionId = divisionIds[division.label]!

				if (division.teamSize === 1) {
					// Individual registrations
					const athletes = divisionAthletes.get(divisionId) || []
					for (const athlete of athletes) {
						const regId = createCompetitionRegistrationId()
						registrationIds.push({
							id: regId,
							divisionId,
							userId: athlete.id,
						})
						registrationInserts.push({
							id: regId,
							eventId: competitionId,
							userId: athlete.id,
							teamMemberId: membershipMap.get(athlete.id)!,
							divisionId,
							registeredAt: new Date(),
							captainUserId: athlete.id,
							paymentStatus: "FREE",
						})
					}
				} else {
					// Team registrations
					const teams = divisionTeams.get(divisionId) || []
					for (const team of teams) {
						const captain = team.members[0]!
						const teamName =
							team.members.length === 2
								? generateTeamName(captain.lastName, team.members[1]!.lastName)
								: `Team ${captain.lastName}`

						// Create registration for each team member
						for (const member of team.members) {
							const regId = createCompetitionRegistrationId()
							registrationIds.push({
								id: regId,
								divisionId,
								userId: member.id,
							})
							registrationInserts.push({
								id: regId,
								eventId: competitionId,
								userId: member.id,
								teamMemberId: membershipMap.get(member.id)!,
								divisionId,
								registeredAt: new Date(),
								captainUserId: captain.id,
								athleteTeamId: team.teamId,
								teamName,
								paymentStatus: "FREE",
							})
						}
					}
				}
			}

			if (registrationInserts.length > 0) {
				await db
					.insert(competitionRegistrationsTable)
					.values(registrationInserts)
			}

			// 11.5 Create commerce product and purchases for revenue demo
			// Create a commerce product for this competition
			const productId = createCommerceProductId()
			await db.insert(commerceProductTable).values({
				id: productId,
				name: `Competition Registration - ${data.name}`,
				type: "COMPETITION_REGISTRATION",
				resourceId: competitionId,
				priceCents: 15000, // Base price $150
			})

			// Platform fee defaults: 2.5% + $2.00
			const PLATFORM_FEE_PERCENTAGE = 250 // basis points
			const PLATFORM_FEE_FIXED = 200 // cents
			// Stripe fee: 2.9% + $0.30
			const STRIPE_FEE_PERCENTAGE = 290 // basis points
			const STRIPE_FEE_FIXED = 30 // cents

			// Create commerce purchases for each registration
			// For team registrations, only create one purchase per team (captain pays)
			const purchaseInserts: Array<typeof commercePurchaseTable.$inferInsert> =
				[]
			const registrationPurchaseMap = new Map<string, string>() // regId -> purchaseId

			// Track unique teams to avoid duplicate purchases
			const processedTeams = new Set<string>()

			for (const reg of registrationInserts) {
				// For team registrations, only create purchase for captain
				if (reg.athleteTeamId) {
					if (processedTeams.has(reg.athleteTeamId)) {
						// Find the purchase for this team's captain and link
						const captainReg = registrationInserts.find(
							(r) =>
								r.athleteTeamId === reg.athleteTeamId &&
								r.userId === r.captainUserId,
						)
						if (captainReg) {
							const captainPurchaseId = registrationPurchaseMap.get(
								captainReg.id as string,
							)
							if (captainPurchaseId) {
								registrationPurchaseMap.set(reg.id as string, captainPurchaseId)
							}
						}
						continue
					}
					processedTeams.add(reg.athleteTeamId)
				}

				// Get division fee
				const division = DEMO_DIVISIONS.find(
					(d) => divisionIds[d.label] === reg.divisionId,
				)
				const registrationFeeCents = division?.feeCents || 15000

				// Calculate fees
				// Platform fee (passed to customer in our config)
				const platformFeeCents = Math.round(
					(registrationFeeCents * PLATFORM_FEE_PERCENTAGE) / 10000 +
						PLATFORM_FEE_FIXED,
				)

				// Total the customer pays (registration + platform fee since it's passed through)
				const totalCents = registrationFeeCents + platformFeeCents

				// Stripe fee (calculated on total, absorbed by organizer in our config)
				const stripeFeeCents = Math.round(
					(totalCents * STRIPE_FEE_PERCENTAGE) / 10000 + STRIPE_FEE_FIXED,
				)

				// Organizer net = registration fee - stripe fee (since they absorb Stripe fees)
				const organizerNetCents = registrationFeeCents - stripeFeeCents

				const purchaseId = createCommercePurchaseId()
				registrationPurchaseMap.set(reg.id as string, purchaseId)

				purchaseInserts.push({
					id: purchaseId,
					userId: reg.userId as string,
					productId,
					status: "COMPLETED",
					competitionId,
					divisionId: reg.divisionId as string,
					totalCents,
					platformFeeCents,
					stripeFeeCents,
					organizerNetCents,
					stripeCheckoutSessionId: `cs_demo_${createId()}`,
					stripePaymentIntentId: `pi_demo_${createId()}`,
					completedAt: new Date(
						Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
					), // Random time in past week
					metadata: JSON.stringify({
						demo: true,
						affiliateName: "Demo CrossFit",
					}),
				})
			}

			if (purchaseInserts.length > 0) {
				await db.insert(commercePurchaseTable).values(purchaseInserts)
			}

			// Update registrations with payment status
			// Group by purchaseId to batch where possible, but each reg may have a different purchaseId
			for (const reg of registrationInserts) {
				const purchaseId = registrationPurchaseMap.get(reg.id as string)
				if (purchaseId) {
					await db
						.update(competitionRegistrationsTable)
						.set({
							paymentStatus: "PAID",
							paidAt: new Date(),
							commercePurchaseId: purchaseId,
						})
						.where(eq(competitionRegistrationsTable.id, reg.id as string))
				}
			}

			// 12. Create heats for workouts 1-2 with smart timing
			// Event 1: 2 hours before demo time (completed, in the past)
			// Event 2: 30 minutes after demo time (about to start during demo)
			// Event 3: No heats (future)
			const heatsCreated: string[] = []
			const heatAssignmentsCreated: string[] = []

			// Event 1 starts 2 hours before demo time
			const event1StartTime = new Date(
				demoDateTime.getTime() - 2 * 60 * 60 * 1000,
			)
			// Event 2 starts 30 minutes after demo time
			const event2StartTime = new Date(demoDateTime.getTime() + 30 * 60 * 1000)

			const eventStartTimes = [event1StartTime, event2StartTime]

			// Create heats for first 2 workouts
			const heatInserts: Array<typeof competitionHeatsTable.$inferInsert> = []
			const heatAssignmentInserts: Array<
				typeof competitionHeatAssignmentsTable.$inferInsert
			> = []

			for (let workoutIdx = 0; workoutIdx < 2; workoutIdx++) {
				const trackWorkoutId = trackWorkoutIds[workoutIdx]!
				const eventBaseTime = eventStartTimes[workoutIdx]!

				// 4 heats per workout (one per division)
				for (let divIdx = 0; divIdx < DEMO_DIVISIONS.length; divIdx++) {
					const heatId = createCompetitionHeatId()
					heatsCreated.push(heatId)

					const division = DEMO_DIVISIONS[divIdx]!
					const divisionId = divisionIds[division.label]!

					// Calculate scheduled time (15 min apart within event)
					const scheduledTime = new Date(
						eventBaseTime.getTime() + divIdx * 15 * 60 * 1000,
					)

					heatInserts.push({
						id: heatId,
						competitionId,
						trackWorkoutId,
						venueId,
						heatNumber: divIdx + 1,
						scheduledTime,
						durationMinutes: 12,
						divisionId,
						schedulePublishedAt: new Date(),
					})

					// Get registrations for this division
					const divisionRegs = registrationIds.filter(
						(r) => r.divisionId === divisionId,
					)

					// For team divisions, only assign unique athlete teams (captains)
					const uniqueRegs =
						division.teamSize > 1
							? divisionRegs.filter(
									(_, idx, arr) =>
										idx ===
										arr.findIndex(
											(r) =>
												registrationInserts.find((ri) => ri.id === r.id)
													?.athleteTeamId ===
												registrationInserts.find(
													(ri) => ri.id === divisionRegs[idx]?.id,
												)?.athleteTeamId,
										),
								)
							: divisionRegs

					// Assign to lanes (10 per heat max)
					const toAssign = uniqueRegs.slice(0, 10)
					for (let laneIdx = 0; laneIdx < toAssign.length; laneIdx++) {
						const reg = toAssign[laneIdx]!
						const assignmentId = createCompetitionHeatAssignmentId()
						heatAssignmentsCreated.push(assignmentId)

						heatAssignmentInserts.push({
							id: assignmentId,
							heatId,
							registrationId: reg.id,
							laneNumber: laneIdx + 1,
						})
					}
				}
			}

			if (heatInserts.length > 0) {
				await db.insert(competitionHeatsTable).values(heatInserts)
			}
			if (heatAssignmentInserts.length > 0) {
				await db
					.insert(competitionHeatAssignmentsTable)
					.values(heatAssignmentInserts)
			}

			// 13. Create scores for Event 1 ONLY (it's completed/in the past)
			// Event 2 has no scores yet - it's about to start during the demo
			let scoresCreated = 0
			const scoreInserts: Array<typeof scoresTable.$inferInsert> = []
			const scoreRoundInserts: Array<typeof scoreRoundsTable.$inferInsert> = []

			// Get the first division ID (heat 1) for creating a tie
			const heat1DivisionId = divisionIds[DEMO_DIVISIONS[0]!.label]!
			let heat1ScoreCount = 0
			let tiedScoreValue: number | null = null // Store the tied score value

			// Only create scores for workout 0 (Event 1)
			for (let workoutIdx = 0; workoutIdx < 1; workoutIdx++) {
				const trackWorkoutId = trackWorkoutIds[workoutIdx]!
				const workoutTemplate = DEMO_WORKOUTS[workoutIdx]!

				// Get workout ID from track workout
				const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
					where: eq(trackWorkoutsTable.id, trackWorkoutId),
				})
				const workoutId = trackWorkout?.workoutId

				if (!workoutId) continue

				// Create scores for all registrations
				for (const reg of registrationIds) {
					const division = DEMO_DIVISIONS.find(
						(d) => divisionIds[d.label] === reg.divisionId,
					)
					if (!division) continue

					const scoreId = `score_${createId()}`
					scoresCreated++

					if (workoutTemplate.scheme === "time-with-cap") {
						const timeCapMs = (workoutTemplate.timeCap || 720) * 1000
						let score = generateTimeScore(timeCapMs, 0.7)

						// For heat 1 (first division), create a tie between first 2 athletes
						const isHeat1 = reg.divisionId === heat1DivisionId
						if (isHeat1) {
							heat1ScoreCount++
							if (heat1ScoreCount === 1) {
								// First athlete - store their score for the tie
								// Make sure they finished (not capped) for a clean tie demo
								score = generateTimeScore(timeCapMs, 1.0) // 100% chance to finish
								tiedScoreValue = score.scoreValue
							} else if (heat1ScoreCount === 2 && tiedScoreValue !== null) {
								// Second athlete - use the same score as first (create tie)
								score = {
									scoreValue: tiedScoreValue,
									status: "scored",
								}
							}
						}

						// Generate tiebreak time: 2-3 minutes faster than total time
						// Tiebreak is at completion of round of 15 (after 36 reps of 45)
						// So tiebreak should be roughly 80% of total time, minus 2-3 min
						const tiebreakOffset = (120 + Math.random() * 60) * 1000 // 2-3 min in ms
						const tiebreakValue =
							score.status === "scored"
								? Math.max(60000, score.scoreValue - tiebreakOffset) // At least 1 min
								: Math.max(60000, timeCapMs * 0.7 - tiebreakOffset) // For capped

						// Compute sortKey for proper ranking with tiebreaks
						const sortKey = sortKeyToString(
							computeSortKey({
								value: score.scoreValue,
								status: score.status,
								scheme: "time-with-cap",
								scoreType: "min",
								timeCap:
									score.status === "cap"
										? {
												ms: timeCapMs,
												secondaryValue: score.secondaryValue ?? 0,
											}
										: undefined,
								tiebreak: { scheme: "time", value: Math.floor(tiebreakValue) },
							}),
						)

						scoreInserts.push({
							id: scoreId,
							userId: reg.userId,
							teamId: competitionTeamId,
							workoutId,
							competitionEventId: trackWorkoutId,
							scheme: "time-with-cap",
							scoreType: "min",
							scoreValue: score.scoreValue,
							status: score.status,
							statusOrder: score.status === "scored" ? 0 : 1,
							sortKey,
							timeCapMs,
							secondaryValue: score.secondaryValue,
							tiebreakScheme: "time",
							tiebreakValue: Math.floor(tiebreakValue),
							scalingLevelId: reg.divisionId,
							asRx: true,
							recordedAt: new Date(),
						})
					} else if (workoutTemplate.scheme === "load") {
						const score = generateLoadScore(
							division.gender,
							workoutTemplate.roundsToScore || 5,
						)

						// Compute sortKey for load scores (no tiebreak)
						const sortKey = sortKeyToString(
							computeSortKey({
								value: score.scoreValue,
								status: "scored",
								scheme: "load",
								scoreType: "sum",
							}),
						)

						scoreInserts.push({
							id: scoreId,
							userId: reg.userId,
							teamId: competitionTeamId,
							workoutId,
							competitionEventId: trackWorkoutId,
							scheme: "load",
							scoreType: "sum",
							scoreValue: score.scoreValue,
							status: "scored",
							statusOrder: 0,
							sortKey,
							scalingLevelId: reg.divisionId,
							asRx: true,
							recordedAt: new Date(),
						})

						// Add individual round scores
						for (let roundNum = 0; roundNum < score.rounds.length; roundNum++) {
							scoreRoundInserts.push({
								id: `scrd_${createId()}`,
								scoreId,
								roundNumber: roundNum + 1,
								value: score.rounds[roundNum]!,
							})
						}
					}
				}
			}

			if (scoreInserts.length > 0) {
				await db.insert(scoresTable).values(scoreInserts)
			}

			if (scoreRoundInserts.length > 0) {
				await db.insert(scoreRoundsTable).values(scoreRoundInserts)
			}

			// 14. Create volunteer users
			const volunteerUsers = await createFakeUsers(
				db,
				20,
				Math.random() > 0.5 ? "male" : "female",
				`${uniquePrefix}vol_`,
			)
			createdUserIds.push(...volunteerUsers.map((u) => u.id))

			// Create volunteer memberships with metadata
			const volunteerMetadata = JSON.stringify({
				volunteerRoleTypes: ["judge"],
				credentials: "Demo Judge",
			})

			const volunteerMembershipIds = await createTeamMemberships(
				db,
				volunteerUsers.map((u) => u.id),
				competitionTeamId,
				"volunteer",
				volunteerMetadata,
			)

			// 15. Create judge rotations and publish for Event 1 (completed event)
			// Event 1 has 4 heats (one per division), numbered 1-4
			// Assign 10 judges to lanes 1-10, each covering all 4 heats
			const event1TrackWorkoutId = trackWorkoutIds[0]!
			const event1Heats = heatsCreated.slice(0, 4) // First 4 heats are Event 1

			// Create rotations for Event 1 - each volunteer judges all 4 heats on their assigned lane
			const rotationInserts: Array<
				typeof competitionJudgeRotationsTable.$inferInsert
			> = []
			for (
				let laneIdx = 0;
				laneIdx < 10 && laneIdx < volunteerMembershipIds.length;
				laneIdx++
			) {
				rotationInserts.push({
					id: createJudgeRotationId(),
					competitionId,
					trackWorkoutId: event1TrackWorkoutId,
					membershipId: volunteerMembershipIds[laneIdx]!,
					startingHeat: 1, // Start at heat 1
					startingLane: laneIdx + 1, // Lane 1-10
					heatsCount: 4, // Cover all 4 heats
					laneShiftPattern: "stay", // Stay on same lane
				})
			}

			if (rotationInserts.length > 0) {
				await db
					.insert(competitionJudgeRotationsTable)
					.values(rotationInserts)
			}

			// Create a published version for Event 1
			const versionId = createJudgeAssignmentVersionId()
			await db.insert(judgeAssignmentVersionsTable).values({
				id: versionId,
				trackWorkoutId: event1TrackWorkoutId,
				version: 1,
				publishedAt: new Date(),
				publishedBy: null, // System generated
				notes: "Demo competition initial assignment",
				isActive: true,
			})

			// Materialize the rotations into actual heat assignments
			// For each rotation, create assignments for all 4 heats
			const assignmentInserts: Array<
				typeof judgeHeatAssignmentsTable.$inferInsert
			> = []
			for (const rotation of rotationInserts) {
				for (let heatIdx = 0; heatIdx < 4; heatIdx++) {
					const heatId = event1Heats[heatIdx]!
					assignmentInserts.push({
						id: createHeatVolunteerId(),
						heatId,
						membershipId: rotation.membershipId,
						rotationId: rotation.id,
						versionId,
						laneNumber: rotation.startingLane,
						position: "judge",
						isManualOverride: false,
					})
				}
			}

			if (assignmentInserts.length > 0) {
				await db.insert(judgeHeatAssignmentsTable).values(assignmentInserts)
			}

			// 16. Create waiver
			await db.insert(waiversTable).values({
				competitionId,
				title: "Liability Waiver",
				content: DEMO_WAIVER_CONTENT,
				required: true,
				position: 0,
			})

			// 17. Update competition settings with tracked IDs and published results
			settings.demoUserIds = createdUserIds
			settings.demoTeamIds = createdTeamIds

			// Publish results for Event 1 (it's completed in the past)
			// event1TrackWorkoutId already defined above in judge rotation section
			const publishedAt = Date.now()
			settings.divisionResults = {
				[event1TrackWorkoutId]: {},
			}

			// Publish all divisions for Event 1
			for (const division of DEMO_DIVISIONS) {
				const divisionId = divisionIds[division.label]!
				settings.divisionResults[event1TrackWorkoutId][divisionId] = {
					publishedAt,
				}
			}

			await db
				.update(competitionsTable)
				.set({ settings: JSON.stringify(settings) })
				.where(eq(competitionsTable.id, competitionId))

			return {
				success: true,
				competitionId,
				competitionSlug: slug,
				summary: {
					divisionsCreated: 4,
					workoutsCreated: 3,
					registrationsCreated: registrationIds.length,
					heatsCreated: heatsCreated.length,
					scoresCreated,
					volunteersCreated: volunteerUsers.length,
				},
			}
		} catch (error) {
			// Best-effort cleanup on failure
			console.error("Demo competition creation failed:", error)

			// Try to clean up created users
			if (createdUserIds.length > 0) {
				try {
					await db
						.delete(userTable)
						.where(inArray(userTable.id, createdUserIds))
				} catch {
					// Ignore cleanup errors
				}
			}

			// Try to clean up created teams
			if (createdTeamIds.length > 0) {
				try {
					await db
						.delete(teamTable)
						.where(inArray(teamTable.id, createdTeamIds))
				} catch {
					// Ignore cleanup errors
				}
			}

			// Rollback Stripe fields if we patched an existing team
			if (stripePatched && originalStripeFields) {
				try {
					await db
						.update(teamTable)
						.set({
							stripeConnectedAccountId:
								originalStripeFields.stripeConnectedAccountId,
							stripeAccountStatus: originalStripeFields.stripeAccountStatus,
							stripeAccountType: originalStripeFields.stripeAccountType,
							stripeOnboardingCompletedAt:
								originalStripeFields.stripeOnboardingCompletedAt,
						})
						.where(eq(teamTable.id, originalStripeFields.teamId))
				} catch {
					// Ignore rollback errors
				}
			}

			throw error
		}
	})

/**
 * List all demo competitions
 */
export const listDemoCompetitionsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<{ competitions: DemoCompetitionSummary[] }> => {
		await requireAdmin()

		const db = getDb()

		// Find competitions with isDemo in settings
		const allCompetitions = await db.query.competitionsTable.findMany({
			orderBy: (table, { desc }) => [desc(table.createdAt)],
		})

		// Filter for demo competitions
		const demoCompetitions: DemoCompetitionSummary[] = []

		for (const comp of allCompetitions) {
			if (comp.settings) {
				try {
					const settings = JSON.parse(comp.settings) as CompetitionSettings
					if (settings.isDemo) {
						// Get registration count
						const regs = await db.query.competitionRegistrationsTable.findMany({
							where: eq(competitionRegistrationsTable.eventId, comp.id),
							columns: { id: true },
						})

						demoCompetitions.push({
							id: comp.id,
							name: comp.name,
							slug: comp.slug,
							startDate: comp.startDate,
							endDate: comp.endDate,
							registrationCount: regs.length,
							createdAt: comp.createdAt,
						})
					}
				} catch {
					// Invalid JSON, skip
				}
			}
		}

		return { competitions: demoCompetitions }
	},
)

/**
 * Delete a demo competition and all related data
 */
export const deleteDemoCompetitionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		deleteDemoCompetitionInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{
			success: boolean
			deletedEntities: {
				users: number
				teams: number
				registrations: number
				scores: number
			}
		}> => {
			await requireAdmin()

			const db = getDb()

			// Get competition and verify it's a demo
			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, data.competitionId),
			})

			if (!competition) {
				throw new Error("Competition not found")
			}

			let settings: CompetitionSettings = {}
			if (competition.settings) {
				try {
					settings = JSON.parse(competition.settings) as CompetitionSettings
				} catch {
					throw new Error("Invalid competition settings")
				}
			}

			if (!settings.isDemo) {
				throw new Error("Cannot delete non-demo competition via this endpoint")
			}

			const deletedCounts = {
				users: 0,
				teams: 0,
				registrations: 0,
				scores: 0,
			}

			// Get demo user and team IDs before deleting anything
			const demoUserIds = settings.demoUserIds || []
			const demoTeamIds = settings.demoTeamIds || []

			// 1. Delete scores first (references workoutId, userId)
			const scores = await db.query.scoresTable.findMany({
				where: eq(scoresTable.teamId, competition.competitionTeamId),
				columns: { id: true },
			})
			deletedCounts.scores = scores.length

			if (scores.length > 0) {
				const scoreIds = scores.map((s) => s.id)
				await db
					.delete(scoreRoundsTable)
					.where(inArray(scoreRoundsTable.scoreId, scoreIds))
				await db.delete(scoresTable).where(inArray(scoresTable.id, scoreIds))
			}

			// 2. Delete judge rotations for this competition
			await db
				.delete(competitionJudgeRotationsTable)
				.where(
					eq(competitionJudgeRotationsTable.competitionId, data.competitionId),
				)

			// 2.5 Delete heat-related data
			const heats = await db.query.competitionHeatsTable.findMany({
				where: eq(competitionHeatsTable.competitionId, data.competitionId),
			})

			if (heats.length > 0) {
				const heatIds = heats.map((h) => h.id)
				await db
					.delete(judgeHeatAssignmentsTable)
					.where(inArray(judgeHeatAssignmentsTable.heatId, heatIds))
				await db
					.delete(competitionHeatAssignmentsTable)
					.where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))
			}

			// Delete heats explicitly (they reference trackWorkoutId, venueId, divisionId)
			await db
				.delete(competitionHeatsTable)
				.where(eq(competitionHeatsTable.competitionId, data.competitionId))

			// 3. Delete commerce purchases and products
			// Delete purchases first (references productId)
			await db
				.delete(commercePurchaseTable)
				.where(eq(commercePurchaseTable.competitionId, data.competitionId))

			// Delete commerce products for this competition
			await db
				.delete(commerceProductTable)
				.where(eq(commerceProductTable.resourceId, data.competitionId))

			// 4. Get registration count and delete
			const regs = await db.query.competitionRegistrationsTable.findMany({
				where: eq(competitionRegistrationsTable.eventId, data.competitionId),
				columns: { id: true },
			})
			deletedCounts.registrations = regs.length

			await db
				.delete(competitionRegistrationsTable)
				.where(eq(competitionRegistrationsTable.eventId, data.competitionId))

			// 4. Delete programming track and related workouts
			const programmingTrack = await db.query.programmingTracksTable.findFirst({
				where: eq(programmingTracksTable.competitionId, data.competitionId),
			})

			if (programmingTrack) {
				// Get track workouts and their workout IDs
				const trackWorkouts = await db.query.trackWorkoutsTable.findMany({
					where: eq(trackWorkoutsTable.trackId, programmingTrack.id),
				})

				const workoutIds = trackWorkouts.map((tw) => tw.workoutId)
				const trackWorkoutIds = trackWorkouts.map((tw) => tw.id)

				// Delete judge assignment versions for track workouts
				if (trackWorkoutIds.length > 0) {
					await db
						.delete(judgeAssignmentVersionsTable)
						.where(
							inArray(
								judgeAssignmentVersionsTable.trackWorkoutId,
								trackWorkoutIds,
							),
						)
				}

				// Delete track workouts first (references trackId, workoutId, sponsorId)
				await db
					.delete(trackWorkoutsTable)
					.where(eq(trackWorkoutsTable.trackId, programmingTrack.id))

				// Delete programming track (references competitionId)
				await db
					.delete(programmingTracksTable)
					.where(eq(programmingTracksTable.id, programmingTrack.id))

				// Delete workout scaling descriptions and workouts
				if (workoutIds.length > 0) {
					try {
						await db
							.delete(workoutScalingDescriptionsTable)
							.where(
								inArray(workoutScalingDescriptionsTable.workoutId, workoutIds),
							)
					} catch {
						// May already be deleted via cascade
					}

					// Delete workouts created for this competition
					try {
						await db
							.delete(workoutsTable)
							.where(inArray(workoutsTable.id, workoutIds))
					} catch {
						// Workout may be referenced elsewhere
					}
				}
			}

			// 5. Delete sponsors (references competitionId)
			await db
				.delete(sponsorsTable)
				.where(eq(sponsorsTable.competitionId, data.competitionId))

			// 6. Delete waivers (references competitionId)
			await db
				.delete(waiversTable)
				.where(eq(waiversTable.competitionId, data.competitionId))

			// 7. Delete competition venues (references competitionId)
			await db
				.delete(competitionVenuesTable)
				.where(eq(competitionVenuesTable.competitionId, data.competitionId))

			// 8. Get and delete scaling levels and groups
			// First get the scalingGroupId from settings
			const scalingGroupId = settings.divisions?.scalingGroupId
			if (scalingGroupId) {
				// Delete competition divisions (references competitionId, divisionId)
				await db
					.delete(competitionDivisionsTable)
					.where(
						eq(competitionDivisionsTable.competitionId, data.competitionId),
					)

				// Delete scaling levels (references scalingGroupId)
				await db
					.delete(scalingLevelsTable)
					.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

				// Delete scaling group
				await db
					.delete(scalingGroupsTable)
					.where(eq(scalingGroupsTable.id, scalingGroupId))
			}

			// 9. Delete team memberships for demo users (in competition_event team and athlete teams)
			if (demoUserIds.length > 0) {
				try {
					await db
						.delete(teamMembershipTable)
						.where(inArray(teamMembershipTable.userId, demoUserIds))
				} catch {
					// Ignore
				}
			}

			// 10. Delete athlete teams (competition_team type) before competition
			deletedCounts.teams = demoTeamIds.length
			if (demoTeamIds.length > 0) {
				try {
					// Delete any remaining memberships in athlete teams
					await db
						.delete(teamMembershipTable)
						.where(inArray(teamMembershipTable.teamId, demoTeamIds))
					await db
						.delete(teamTable)
						.where(inArray(teamTable.id, demoTeamIds))
				} catch {
					// Team may have been deleted via cascade
				}
			}

			// 11. Delete competition (now that all references are removed)
			// Store primaryAddressId before deletion
			const primaryAddressId = competition.primaryAddressId
			await db
				.delete(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))

			// 11.5 Delete primary address if exists
			if (primaryAddressId) {
				try {
					await db
						.delete(addressesTable)
						.where(eq(addressesTable.id, primaryAddressId))
				} catch {
					// Ignore if already deleted
				}
			}

			// 12. Delete demo users
			if (demoUserIds.length > 0) {
				try {
					await db
						.delete(userTable)
						.where(inArray(userTable.id, demoUserIds))
					deletedCounts.users = demoUserIds.length
				} catch {
					// User may have been deleted already or has other references
				}
			}

			// 13. Also delete any users with demo email domain as fallback
			// Constrain to users who were actually registered in this competition
			// to avoid deleting users from other demo competitions
			const competitionRegistrations =
				await db.query.competitionRegistrationsTable.findMany({
					where: eq(competitionRegistrationsTable.eventId, data.competitionId),
					columns: { userId: true },
				})
			const registeredUserIds = competitionRegistrations.map((r) => r.userId)

			if (registeredUserIds.length > 0) {
				// Find demo email users who were registered in this specific competition
				const demoEmailUsers = await db.query.userTable.findMany({
					where: and(
						like(userTable.email, `%@${DEMO_EMAIL_DOMAIN}`),
						inArray(userTable.id, registeredUserIds),
					),
				})

				const extraUserIds = demoEmailUsers
					.filter((user) => !demoUserIds.includes(user.id))
					.map((user) => user.id)

				if (extraUserIds.length > 0) {
					try {
						await db
							.delete(teamMembershipTable)
							.where(inArray(teamMembershipTable.userId, extraUserIds))
						await db
							.delete(userTable)
							.where(inArray(userTable.id, extraUserIds))
						deletedCounts.users += extraUserIds.length
					} catch {
						// Ignore
					}
				}
			}

			return {
				success: true,
				deletedEntities: deletedCounts,
			}
		},
	)

/**
 * Get available organizing teams (gym type) for demo competition creation
 */
export const getOrganizingTeamsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<{
		teams: Array<{ id: string; name: string; slug: string }>
	}> => {
		await requireAdmin()

		const db = getDb()

		const teams = await db.query.teamTable.findMany({
			where: eq(teamTable.type, "gym"),
			columns: {
				id: true,
				name: true,
				slug: true,
			},
			orderBy: (table, { asc }) => [asc(table.name)],
		})

		return { teams }
	},
)
