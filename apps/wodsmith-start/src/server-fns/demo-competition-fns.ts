/**
 * Demo Competition Server Functions
 * Handles generation, listing, and deletion of demo competitions for client demos
 *
 * This file uses top-level imports for server-only modules.
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { eq, like } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	commerceProductTable,
	commercePurchaseTable,
	competitionDivisionsTable,
} from "@/db/schemas/commerce"
import {
	createCommerceProductId,
	createCommercePurchaseId,
	createCompetitionHeatAssignmentId,
	createCompetitionHeatId,
	createCompetitionRegistrationId,
	createCompetitionVenueId,
	createHeatVolunteerId,
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
import { judgeHeatAssignmentsTable } from "@/db/schemas/volunteers"
import { waiversTable } from "@/db/schemas/waivers"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import {
	DEMO_DIVISIONS,
	DEMO_EMAIL_DOMAIN,
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
import { requireAdmin } from "@/utils/auth"
import { chunk } from "@/utils/batch-query"
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

	// Batch insert users (11 params per row based on actual SQL, 100/11 = 9)
	const batchSize = 5
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

	// Insert in batches
	for (const batch of chunk(userInserts, batchSize)) {
		await db.insert(userTable).values(batch)
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
	const batchSize = 9 // ~10 columns per membership, 100/10 = 10, use 9 for safety

	const membershipInserts: Array<typeof teamMembershipTable.$inferInsert> = []

	for (const userId of userIds) {
		const membershipId = createTeamMembershipId()
		membershipInserts.push({
			id: membershipId,
			teamId,
			userId,
			roleId,
			isSystemRole: 1,
			joinedAt: new Date(),
			isActive: 1,
			metadata,
		})
		membershipIds.push(membershipId)
	}

	for (const batch of chunk(membershipInserts, batchSize)) {
		await db.insert(teamMembershipTable).values(batch)
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

		try {
			// 1. Get or create organizing team with Stripe Connect setup
			let organizingTeamId = data.organizingTeamId
			const demoStripeAccountId = `acct_demo_${createId().substring(0, 16)}`

			if (!organizingTeamId) {
				// Create a demo organizing team with Stripe Connect already set up
				const demoOrgTeam = await db
					.insert(teamTable)
					.values({
						id: createTeamId(),
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
					.returning()

				organizingTeamId = demoOrgTeam[0]!.id
				createdTeamIds.push(organizingTeamId)
			} else {
				// Update existing team with Stripe Connect data if not already set
				const existingTeam = await db.query.teamTable.findFirst({
					where: eq(teamTable.id, organizingTeamId),
				})

				if (existingTeam && !existingTeam.stripeConnectedAccountId) {
					await db
						.update(teamTable)
						.set({
							stripeConnectedAccountId: demoStripeAccountId,
							stripeAccountStatus: "VERIFIED",
							stripeAccountType: "express",
							stripeOnboardingCompletedAt: new Date(),
						})
						.where(eq(teamTable.id, organizingTeamId))
				}
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
			const demoDateTime = new Date(`${data.competitionDate}T${data.demoTime}:00`)

			// Keep as draft/unpublished - organizer can publish when ready
			// Set up fee configuration for revenue demo
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
				})
				.where(eq(competitionsTable.id, competitionId))

			// 3. Create scaling group and divisions
			const scalingGroupId = createScalingGroupId()
			await db.insert(scalingGroupsTable).values({
				id: scalingGroupId,
				title: "Demo Competition Divisions",
				teamId: organizingTeamId,
				isDefault: 0,
				isSystem: 0,
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

			// Create sponsors first
			for (const sponsor of DEMO_SPONSORS) {
				const sponsorId = createSponsorId()
				sponsorIds.push(sponsorId)
				await db.insert(sponsorsTable).values({
					id: sponsorId,
					competitionId,
					name: sponsor.name,
					website: sponsor.website,
					displayOrder: sponsorIds.length - 1,
				})
			}

			// Create workouts
			for (let i = 0; i < DEMO_WORKOUTS.length; i++) {
				const template = DEMO_WORKOUTS[i]!
				const workoutId = `wkt_${createId()}`
				workoutIds.push(workoutId)

				await db.insert(workoutsTable).values({
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

				await db.insert(trackWorkoutsTable).values({
					id: trackWorkoutId,
					trackId,
					workoutId,
					trackOrder: i + 1,
					pointsMultiplier: 100,
					heatStatus: i < 2 ? "published" : "draft", // First 2 have heats
					eventStatus: "published",
					sponsorId: sponsorIds[i],
				})

				// 6.5 Create workout scaling descriptions for each division
				// These show the gender-specific weight prescriptions
				for (const division of DEMO_DIVISIONS) {
					const divisionId = divisionIds[division.label]!
					const isTeam = division.teamSize > 1

					// Build the scaling description based on gender
					let scalingDescription =
						division.gender === "male"
							? template.maleScaling
							: template.femaleScaling

					// Append team notes if it's a team division
					if (isTeam && template.teamNotes && scalingDescription) {
						scalingDescription += `\n\n**Team Format:**\n${template.teamNotes}`
					}

					if (scalingDescription) {
						await db.insert(workoutScalingDescriptionsTable).values({
							id: createWorkoutScalingDescriptionId(),
							workoutId,
							scalingLevelId: divisionId,
							description: scalingDescription,
						})
					}
				}
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

			// Insert registrations in batches (registrations table has ~17 columns, 100/17 = 5.8)
			for (const batch of chunk(registrationInserts, 5)) {
				await db.insert(competitionRegistrationsTable).values(batch)
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
					completedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in past week
					metadata: JSON.stringify({
						demo: true,
						affiliateName: "Demo CrossFit",
					}),
				})
			}

			// Insert purchases in batches (~18 columns, 100/18 = 5.5)
			for (const batch of chunk(purchaseInserts, 5)) {
				await db.insert(commercePurchaseTable).values(batch)
			}

			// Update registrations with payment status
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
			const event2StartTime = new Date(
				demoDateTime.getTime() + 30 * 60 * 1000,
			)

			const eventStartTimes = [event1StartTime, event2StartTime]

			// Create heats for first 2 workouts
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

					await db.insert(competitionHeatsTable).values({
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

						await db.insert(competitionHeatAssignmentsTable).values({
							id: assignmentId,
							heatId,
							registrationId: reg.id,
							laneNumber: laneIdx + 1,
						})
					}
				}
			}

			// 13. Create scores for Event 1 ONLY (it's completed/in the past)
			// Event 2 has no scores yet - it's about to start during the demo
			let scoresCreated = 0
			const scoreInserts: Array<typeof scoresTable.$inferInsert> = []
			const scoreRoundInserts: Array<typeof scoreRoundsTable.$inferInsert> = []

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
						const score = generateTimeScore(timeCapMs, 0.7)

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
							timeCapMs,
							secondaryValue: score.secondaryValue,
							scalingLevelId: reg.divisionId,
							asRx: true,
							recordedAt: new Date(),
						})
					} else if (workoutTemplate.scheme === "load") {
						const score = generateLoadScore(
							division.gender,
							workoutTemplate.roundsToScore || 5,
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

			// Insert scores in batches (scores table has ~22 columns, 100/22 = 4.5)
			for (const batch of chunk(scoreInserts, 4)) {
				await db.insert(scoresTable).values(batch)
			}

			// Insert score rounds in batches (score_rounds has ~9 columns, 100/9 = 11)
			for (const batch of chunk(scoreRoundInserts, 10)) {
				await db.insert(scoreRoundsTable).values(batch)
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

			// 15. Create judge heat assignments for workouts 1-2
			for (let workoutIdx = 0; workoutIdx < 2; workoutIdx++) {
				// Get heats for this workout (4 heats)
				const workoutHeats = heatsCreated.slice(
					workoutIdx * 4,
					(workoutIdx + 1) * 4,
				)

				for (const heatId of workoutHeats) {
					// Assign 10 judges (1 per lane)
					const shuffledMembershipIds = shuffleArray(volunteerMembershipIds)
					for (
						let laneIdx = 0;
						laneIdx < 10 && laneIdx < shuffledMembershipIds.length;
						laneIdx++
					) {
						await db.insert(judgeHeatAssignmentsTable).values({
							id: createHeatVolunteerId(),
							heatId,
							membershipId: shuffledMembershipIds[laneIdx]!,
							laneNumber: laneIdx + 1,
							position: "judge",
						})
					}
				}
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
			const event1TrackWorkoutId = trackWorkoutIds[0]!
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
			for (const userId of createdUserIds) {
				try {
					await db.delete(userTable).where(eq(userTable.id, userId))
				} catch {
					// Ignore cleanup errors
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

			for (const score of scores) {
				await db
					.delete(scoreRoundsTable)
					.where(eq(scoreRoundsTable.scoreId, score.id))
				await db.delete(scoresTable).where(eq(scoresTable.id, score.id))
			}

			// 2. Delete heat-related data
			const heats = await db.query.competitionHeatsTable.findMany({
				where: eq(competitionHeatsTable.competitionId, data.competitionId),
			})

			for (const heat of heats) {
				await db
					.delete(judgeHeatAssignmentsTable)
					.where(eq(judgeHeatAssignmentsTable.heatId, heat.id))
				await db
					.delete(competitionHeatAssignmentsTable)
					.where(eq(competitionHeatAssignmentsTable.heatId, heat.id))
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
			const products = await db.query.commerceProductTable.findMany({
				where: eq(commerceProductTable.resourceId, data.competitionId),
			})
			for (const product of products) {
				await db
					.delete(commerceProductTable)
					.where(eq(commerceProductTable.id, product.id))
			}

			// 4. Get registrations and delete
			const regs = await db.query.competitionRegistrationsTable.findMany({
				where: eq(competitionRegistrationsTable.eventId, data.competitionId),
				columns: { id: true },
			})
			deletedCounts.registrations = regs.length

			for (const reg of regs) {
				await db
					.delete(competitionRegistrationsTable)
					.where(eq(competitionRegistrationsTable.id, reg.id))
			}

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

				// Delete track workouts first (references trackId, workoutId, sponsorId)
				await db
					.delete(trackWorkoutsTable)
					.where(eq(trackWorkoutsTable.trackId, programmingTrack.id))

				// Delete programming track (references competitionId)
				await db
					.delete(programmingTracksTable)
					.where(eq(programmingTracksTable.id, programmingTrack.id))

				// Delete workout scaling descriptions for each workout
				for (const workoutId of workoutIds) {
					try {
						await db
							.delete(workoutScalingDescriptionsTable)
							.where(eq(workoutScalingDescriptionsTable.workoutId, workoutId))
					} catch {
						// May already be deleted via cascade
					}
				}

				// Delete workouts created for this competition
				for (const workoutId of workoutIds) {
					try {
						await db
							.delete(workoutsTable)
							.where(eq(workoutsTable.id, workoutId))
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
					.where(eq(competitionDivisionsTable.competitionId, data.competitionId))

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
			for (const userId of demoUserIds) {
				try {
					await db
						.delete(teamMembershipTable)
						.where(eq(teamMembershipTable.userId, userId))
				} catch {
					// Ignore
				}
			}

			// 10. Delete athlete teams (competition_team type) before competition
			deletedCounts.teams = demoTeamIds.length
			for (const teamId of demoTeamIds) {
				try {
					// Delete any remaining memberships in athlete teams
					await db
						.delete(teamMembershipTable)
						.where(eq(teamMembershipTable.teamId, teamId))
					await db.delete(teamTable).where(eq(teamTable.id, teamId))
				} catch {
					// Team may have been deleted via cascade
				}
			}

			// 11. Delete competition (now that all references are removed)
			await db
				.delete(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))

			// 12. Delete demo users
			if (demoUserIds.length > 0) {
				for (const userId of demoUserIds) {
					try {
						await db.delete(userTable).where(eq(userTable.id, userId))
						deletedCounts.users++
					} catch {
						// User may have been deleted already or has other references
					}
				}
			}

			// 13. Also delete any users with demo email domain as fallback
			const demoEmailUsers = await db.query.userTable.findMany({
				where: like(userTable.email, `%@${DEMO_EMAIL_DOMAIN}`),
			})

			for (const user of demoEmailUsers) {
				if (!demoUserIds.includes(user.id)) {
					try {
						// Delete their memberships first
						await db
							.delete(teamMembershipTable)
							.where(eq(teamMembershipTable.userId, user.id))
						await db.delete(userTable).where(eq(userTable.id, user.id))
						deletedCounts.users++
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
