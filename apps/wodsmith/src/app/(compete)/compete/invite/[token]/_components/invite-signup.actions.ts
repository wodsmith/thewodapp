"use server"

import { eq, and } from "drizzle-orm"
import { redirect } from "next/navigation"
import { createServerAction, ZSAError } from "@repo/zsa"
import { z } from "zod"
import { getDb } from "@/db"
import {
	userTable,
	teamInvitationTable,
	teamMembershipTable,
	TEAM_TYPE_ENUM,
} from "@/db/schema"
import { isTurnstileEnabled } from "@/flags"
import { createPersonalTeamForUser } from "@/server/user"
import {
	canSignUp,
	createSession,
	generateSessionToken,
	setSessionTokenCookie,
} from "@/utils/auth"
import { getIP } from "@/utils/get-IP"
import { hashPassword } from "@/utils/password-hasher"
import { validateTurnstileToken } from "@/utils/validate-captcha"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"
import { catchaSchema } from "@/schemas/catcha.schema"
import { updateAllSessionsOfUser } from "@/utils/kv-session"

const inviteSignUpSchema = z.object({
	email: z.string().email(),
	firstName: z.string().min(2).max(255),
	lastName: z.string().min(2).max(255),
	password: z.string().min(6),
	captchaToken: catchaSchema,
	inviteToken: z.string().min(1),
})

/**
 * Sign up and auto-accept team invite in one action.
 * If the email differs from the invite email, updates the invite first.
 */
export const inviteSignUpAction = createServerAction()
	.input(inviteSignUpSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			const db = getDb()

			if ((await isTurnstileEnabled()) && input.captchaToken) {
				const success = await validateTurnstileToken(input.captchaToken)
				if (!success) {
					throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha")
				}
			}

			// Find the invitation by token
			const invitation = await db.query.teamInvitationTable.findFirst({
				where: eq(teamInvitationTable.token, input.inviteToken),
				with: { team: true },
			})

			if (!invitation) {
				throw new ZSAError("NOT_FOUND", "Invitation not found")
			}

			// Check if invitation has expired
			if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
				throw new ZSAError("ERROR", "Invitation has expired")
			}

			// Check if invitation was already accepted
			if (invitation.acceptedAt) {
				throw new ZSAError("CONFLICT", "Invitation has already been accepted")
			}

			const team = Array.isArray(invitation.team)
				? invitation.team[0]
				: invitation.team

			// Check if email is disposable
			await canSignUp({ email: input.email })

			// Check if email is already taken
			const existingUser = await db.query.userTable.findFirst({
				where: eq(userTable.email, input.email),
			})

			if (existingUser) {
				throw new ZSAError("CONFLICT", "Email already taken")
			}

			// If email differs from invite email, update the invite
			const emailChanged =
				input.email.toLowerCase() !== invitation.email.toLowerCase()

			if (emailChanged) {
				// Update invitation email
				await db
					.update(teamInvitationTable)
					.set({
						email: input.email.toLowerCase(),
						updatedAt: new Date(),
					})
					.where(eq(teamInvitationTable.id, invitation.id))

				// Also update pendingTeammates in competition registration if this is a competition team
				if (
					team?.type === TEAM_TYPE_ENUM.COMPETITION_TEAM &&
					team.competitionMetadata
				) {
					try {
						const metadata = JSON.parse(team.competitionMetadata) as {
							competitionId?: string
						}
						if (metadata.competitionId) {
							const { competitionRegistrationsTable } = await import(
								"@/db/schema"
							)

							// Find registration with this team
							const registration =
								await db.query.competitionRegistrationsTable.findFirst({
									where: and(
										eq(
											competitionRegistrationsTable.eventId,
											metadata.competitionId,
										),
										eq(competitionRegistrationsTable.athleteTeamId, team.id),
									),
								})

							if (registration?.pendingTeammates) {
								const pending = JSON.parse(
									registration.pendingTeammates,
								) as Array<{
									email: string
									firstName?: string
									lastName?: string
								}>

								// Update the email in pendingTeammates
								const updatedPending = pending.map((t) =>
									t.email.toLowerCase() === invitation.email.toLowerCase()
										? { ...t, email: input.email.toLowerCase() }
										: t,
								)

								await db
									.update(competitionRegistrationsTable)
									.set({
										pendingTeammates: JSON.stringify(updatedPending),
									})
									.where(eq(competitionRegistrationsTable.id, registration.id))
							}
						}
					} catch {
						// Ignore JSON parse errors
					}
				}
			}

			// Hash the password
			const hashedPassword = await hashPassword({ password: input.password })

			// Create the user
			const [user] = await db
				.insert(userTable)
				.values({
					email: input.email,
					firstName: input.firstName,
					lastName: input.lastName,
					passwordHash: hashedPassword,
					signUpIpAddress: await getIP(),
					emailVerified: new Date(),
				})
				.returning()

			if (!user || !user.email) {
				throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create user")
			}

			// Create personal team
			try {
				await createPersonalTeamForUser(user)
			} catch (error) {
				console.error("Failed to create personal team:", user.id, error)
				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"Failed to set up user account. Please try again.",
				)
			}

			// Create session
			const sessionToken = generateSessionToken()
			const session = await createSession({
				token: sessionToken,
				userId: user.id,
				authenticationType: "password",
			})

			await setSessionTokenCookie({
				token: sessionToken,
				userId: user.id,
				expiresAt: new Date(session.expiresAt),
			})

			// Now accept the invitation
			// Add user to the team
			await db.insert(teamMembershipTable).values({
				teamId: invitation.teamId,
				userId: user.id,
				roleId: invitation.roleId,
				isSystemRole: Number(invitation.isSystemRole),
				invitedBy: invitation.invitedBy,
				invitedAt: invitation.createdAt
					? new Date(invitation.createdAt)
					: new Date(),
				joinedAt: new Date(),
				isActive: 1,
			})

			// Mark invitation as accepted
			await db
				.update(teamInvitationTable)
				.set({
					acceptedAt: new Date(),
					acceptedBy: user.id,
					updatedAt: new Date(),
				})
				.where(eq(teamInvitationTable.id, invitation.id))

			// Update sessions
			await updateAllSessionsOfUser(user.id)

			// Handle competition_team type - also add user to competition_event team
			let competitionSlug: string | undefined

			if (
				team?.type === TEAM_TYPE_ENUM.COMPETITION_TEAM &&
				team.competitionMetadata
			) {
				try {
					const metadata = JSON.parse(team.competitionMetadata) as {
						competitionId?: string
					}
					if (metadata.competitionId) {
						const {
							addToCompetitionEventTeam,
							clearPendingTeammate,
							getCompetition,
						} = await import("@/server/competitions")
						await addToCompetitionEventTeam(user.id, metadata.competitionId)
						await clearPendingTeammate(
							metadata.competitionId,
							user.email,
							user.id,
						)

						// Get competition slug for redirect
						const competition = await getCompetition(metadata.competitionId)
						if (competition) {
							competitionSlug = competition.slug
						}
					}
				} catch {
					// Ignore errors
				}
			}

			// Use server-side redirect to prevent race condition where page re-renders
			// with "Already Accepted" message before client-side redirect completes
			const redirectUrl = competitionSlug
				? `/compete/${competitionSlug}`
				: "/compete"

			redirect(redirectUrl)
		}, RATE_LIMITS.SIGN_UP)
	})

/**
 * Check if an email exists (for inline form logic)
 */
export const checkEmailExistsAction = createServerAction()
	.input(z.object({ email: z.string().email() }))
	.handler(async ({ input }) => {
		const db = getDb()

		const user = await db.query.userTable.findFirst({
			where: eq(userTable.email, input.email.toLowerCase()),
			columns: { id: true },
		})

		return { exists: !!user }
	})
