import { encodeHexLowerCase } from "@oslojs/encoding"
import { init } from "@paralleldrive/cuid2"
import { getCookie, setCookie, deleteCookie } from "vinxi/http"
import { eq } from "drizzle-orm"
import ms from "ms"
import { ACTIVE_TEAM_COOKIE_NAME, SESSION_COOKIE_NAME } from "~/constants"
import { getDb } from "~/db/index.server"
import {
	ROLES_ENUM,
	SYSTEM_ROLES_ENUM,
	TEAM_PERMISSIONS,
	teamMembershipTable,
	userTable,
} from "~/db/schema"
import type { SessionValidationResult } from "~/types"
import isProd from "~/utils/is-prod"
import { addFreeMonthlyCreditsIfNeeded } from "./credits.server"
import {
	type CreateKVSessionParams,
	CURRENT_SESSION_VERSION,
	createKVSession,
	deleteKVSession,
	getKVSession,
	type KVSession,
	updateKVSession,
} from "./kv-session.server"
import { getInitials } from "./name-initials"

const getSessionLength = () => {
	return ms("30d")
}

/**
 * This file is based on https://lucia-auth.com
 */

export async function getUserFromDB(userId: string) {
	const db = getDb()
	return await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
		columns: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			emailVerified: true,
			avatar: true,
			createdAt: true,
			updatedAt: true,
			currentCredits: true,
			lastCreditRefreshAt: true,
		},
	})
}

const createId = init({
	length: 32,
})

export function generateSessionToken(): string {
	return createId()
}

async function generateSessionId(token: string): Promise<string> {
	const hashBuffer = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	)
	return encodeHexLowerCase(new Uint8Array(hashBuffer))
}

function encodeSessionCookie(userId: string, token: string): string {
	return `${userId}:${token}`
}

function decodeSessionCookie(
	cookie: string,
): { userId: string; token: string } | null {
	const parts = cookie.split(":")
	if (parts.length !== 2 || !parts[0] || !parts[1]) return null
	return { userId: parts[0], token: parts[1] }
}

interface CreateSessionParams
	extends Pick<
		CreateKVSessionParams,
		"authenticationType" | "passkeyCredentialId" | "userId"
	> {
	token: string
}

export async function getUserTeamsWithPermissions(userId: string): Promise<
	{
		id: string
		name: string
		slug: string
		type: string
		isPersonalTeam: boolean
		role: {
			id: string
			name: string
			isSystemRole: boolean
		}
		permissions: string[]
		plan?: {
			id: string
			name: string
			features: string[]
			limits: Record<string, number>
		}
	}[]
> {
	const db = getDb()

	// Get user's team memberships
	const userTeamMemberships = await db.query.teamMembershipTable.findMany({
		where: eq(teamMembershipTable.userId, userId),
		with: {
			team: true,
		},
	})

	// Get all custom role IDs that need to be fetched
	const customRoleIds = userTeamMemberships
		.filter((m) => !m.isSystemRole)
		.map((m) => m.roleId)

	// Fetch all custom roles in one query
	const customRoles =
		customRoleIds.length > 0
			? await db.query.teamRoleTable.findMany({
					where: (table, { inArray }) => inArray(table.id, customRoleIds),
				})
			: []

	// Create a map for quick role lookup
	const roleMap = new Map(customRoles.map((role) => [role.id, role]))

	// Fetch plans for all teams in parallel
	const teamIds = userTeamMemberships.map((m) => m.teamId)
	const { getTeamPlan } = await import("~/server/entitlements.server")
	const teamPlansPromises = teamIds.map((teamId) => getTeamPlan(teamId))
	const teamPlans = await Promise.all(teamPlansPromises)
	const planMap = new Map(teamPlans.map((plan, i) => [teamIds[i], plan]))

	// Process memberships without async operations
	return userTeamMemberships.map((membership) => {
		let roleName = ""
		let permissions: string[] = []

		// Handle system roles
		if (membership.isSystemRole) {
			roleName = membership.roleId // For system roles, roleId contains the role name

			// For system roles, get permissions based on role
			if (
				membership.roleId === SYSTEM_ROLES_ENUM.OWNER ||
				membership.roleId === SYSTEM_ROLES_ENUM.ADMIN
			) {
				// Owners and admins have all permissions
				permissions = Object.values(TEAM_PERMISSIONS)
			} else if (membership.roleId === SYSTEM_ROLES_ENUM.MEMBER) {
				// Default permissions for members
				permissions = [
					TEAM_PERMISSIONS.ACCESS_DASHBOARD,
					TEAM_PERMISSIONS.CREATE_COMPONENTS,
					TEAM_PERMISSIONS.EDIT_COMPONENTS,
				]
			} else if (membership.roleId === SYSTEM_ROLES_ENUM.GUEST) {
				// Guest permissions are limited
				permissions = [TEAM_PERMISSIONS.ACCESS_DASHBOARD]
			}
		} else {
			// Handle custom roles using pre-fetched data
			const role = roleMap.get(membership.roleId)
			if (role) {
				roleName = role.name
				// Parse the stored JSON permissions
				permissions = role.permissions as string[]
			}
		}

		const plan = planMap.get(membership.teamId)

		const team =
			membership.team && "name" in membership.team ? membership.team : null
		return {
			id: membership.teamId,
			name: team?.name ?? "",
			slug: team?.slug ?? "",
			type: team?.type ?? "gym",
			isPersonalTeam: !!team?.isPersonalTeam,
			role: {
				id: membership.roleId,
				name: roleName,
				isSystemRole: !!membership.isSystemRole,
			},
			permissions,
			plan: plan
				? {
						id: plan.id,
						name: plan.name,
						features: plan.entitlements.features,
						limits: plan.entitlements.limits,
					}
				: undefined,
		}
	})
}

export async function createSession({
	token,
	userId,
	authenticationType,
	passkeyCredentialId,
}: CreateSessionParams): Promise<KVSession> {
	const sessionId = await generateSessionId(token)
	const expiresAt = new Date(Date.now() + getSessionLength())

	const user = await getUserFromDB(userId)

	if (!user) {
		throw new Error("User not found")
	}

	const teamsWithPermissions = await getUserTeamsWithPermissions(userId)

	return createKVSession({
		sessionId,
		userId,
		expiresAt,
		user,
		authenticationType,
		passkeyCredentialId,
		teams: teamsWithPermissions,
	})
}

export async function createAndStoreSession(
	userId: string,
	authenticationType?: CreateKVSessionParams["authenticationType"],
	passkeyCredentialId?: CreateKVSessionParams["passkeyCredentialId"],
) {
	const sessionToken = generateSessionToken()
	const session = await createSession({
		token: sessionToken,
		userId,
		authenticationType,
		passkeyCredentialId,
	})
	await setSessionTokenCookie({
		token: sessionToken,
		userId,
		expiresAt: new Date(session.expiresAt),
	})

	// Set personal team as active by default
	const personalTeam = session.teams?.find((t) => t.isPersonalTeam)
	if (personalTeam) {
		await setActiveTeamCookie(personalTeam.id)
	}
}

async function validateSessionToken(
	token: string,
	userId: string,
): Promise<SessionValidationResult | null> {
	const sessionId = await generateSessionId(token)

	let session = await getKVSession(sessionId, userId)

	if (!session) return null

	// If the session has expired, delete it and return null
	if (Date.now() >= session.expiresAt) {
		await deleteKVSession(sessionId, userId)
		return null
	}

	// Check if session version needs to be updated
	if (!session.version || session.version !== CURRENT_SESSION_VERSION) {
		session = await updateKVSession(
			sessionId,
			userId,
			new Date(session.expiresAt),
		)

		if (!session) {
			return null
		}

		// Update the user initials without mutation
		session = {
			...session,
			user: {
				...session.user,
				initials: getInitials(
					`${session.user.firstName} ${session.user.lastName}`,
				),
			},
		}

		return session
	}

	// Check and refresh credits if needed
	const currentCredits = await addFreeMonthlyCreditsIfNeeded(session)

	// Create a new session object if credits need updating
	let finalSession = session
	if (
		session?.user?.currentCredits &&
		currentCredits !== session.user.currentCredits
	) {
		finalSession = {
			...session,
			user: { ...session.user, currentCredits },
		}
	}

	// Add initials without mutation
	finalSession = {
		...finalSession,
		user: {
			...finalSession.user,
			initials: getInitials(
				`${finalSession.user.firstName} ${finalSession.user.lastName}`,
			),
		},
	}

	return finalSession
}

export async function invalidateSession(
	sessionId: string,
	userId: string,
): Promise<void> {
	await deleteKVSession(sessionId, userId)
}

interface SetSessionTokenCookieParams {
	token: string
	userId: string
	expiresAt: Date
}

export async function setSessionTokenCookie({
	token,
	userId,
	expiresAt,
}: SetSessionTokenCookieParams): Promise<void> {
	setCookie(SESSION_COOKIE_NAME, encodeSessionCookie(userId, token), {
		httpOnly: true,
		sameSite: isProd ? "strict" : "lax",
		secure: isProd,
		expires: expiresAt,
		path: "/",
	})
}

export async function deleteSessionTokenCookie(): Promise<void> {
	deleteCookie(SESSION_COOKIE_NAME)
}

/**
 * Get the active team ID from cookie
 * @returns The team ID or null if not set
 */
export async function getActiveTeamFromCookie(): Promise<string | null> {
	const activeTeamCookie = getCookie(ACTIVE_TEAM_COOKIE_NAME)

	if (!activeTeamCookie) {
		return null
	}

	return activeTeamCookie
}

/**
 * Set the active team cookie
 * @param teamId - The team ID to set as active
 */
export async function setActiveTeamCookie(teamId: string): Promise<void> {
	setCookie(ACTIVE_TEAM_COOKIE_NAME, teamId, {
		httpOnly: true,
		sameSite: isProd ? "strict" : "lax",
		secure: isProd,
		expires: new Date(Date.now() + getSessionLength()),
		path: "/",
	})
}

/**
 * Delete the active team cookie
 */
export async function deleteActiveTeamCookie(): Promise<void> {
	deleteCookie(ACTIVE_TEAM_COOKIE_NAME)
}

/**
 * Get the active team ID or fallback to user's personal team
 * Validates that the active team exists in the user's session
 * @param userId - The user's ID
 * @returns The active team ID or personal team ID as fallback
 */
export async function getActiveOrPersonalTeamId(
	userId: string,
): Promise<string> {
	const session = await getSessionFromCookie()
	const activeTeamId = await getActiveTeamFromCookie()

	// If no active team cookie, get personal team
	if (!activeTeamId || !session?.teams) {
		const { getUserPersonalTeamId } = await import("~/server/user.server")
		return getUserPersonalTeamId(userId)
	}

	// Validate that active team exists in user's session
	const isValidTeam = session.teams.some((team) => team.id === activeTeamId)

	if (!isValidTeam) {
		// Active team is invalid, fall back to personal team
		const { getUserPersonalTeamId } = await import("~/server/user.server")
		return getUserPersonalTeamId(userId)
	}

	return activeTeamId
}

/**
 * Get session from cookie - can only be called in server functions
 */
export async function getSessionFromCookie(): Promise<SessionValidationResult | null> {
	const sessionCookie = getCookie(SESSION_COOKIE_NAME)

	if (!sessionCookie) {
		return null
	}

	const decoded = decodeSessionCookie(sessionCookie)

	if (!decoded || !decoded.token || !decoded.userId) {
		return null
	}

	return validateSessionToken(decoded.token, decoded.userId)
}

export async function requireVerifiedEmail() {
	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("Not authenticated")
	}

	return session
}

export async function requireAdmin({
	doNotThrowError = false,
}: {
	doNotThrowError?: boolean
} = {}) {
	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("Not authenticated")
	}

	if (session.user.role !== ROLES_ENUM.ADMIN) {
		if (doNotThrowError) {
			return null
		}

		throw new Error("Not authorized")
	}

	return session
}

export async function requireAdminForTeam({
	doNotThrowError = false,
	teamIdOrSlug,
}: {
	doNotThrowError?: boolean
	teamIdOrSlug?: string
} = {}) {
	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("Not authenticated")
	}

	const team = session?.teams?.find(
		(t) => t.id === teamIdOrSlug || t.slug === teamIdOrSlug,
	)

	// Allow both OWNER and ADMIN roles
	if (
		!team ||
		(team.role.name !== SYSTEM_ROLES_ENUM.OWNER &&
			team.role.name !== SYSTEM_ROLES_ENUM.ADMIN)
	) {
		if (doNotThrowError) {
			return null
		}

		throw new Error("Not authorized")
	}

	return session
}

interface DisposableEmailResponse {
	disposable: string
}

interface MailcheckResponse {
	status: number
	email: string
	domain: string
	mx: boolean
	disposable: boolean
	public_domain: boolean
	relay_domain: boolean
	alias: boolean
	role_account: boolean
	did_you_mean: string | null
}

type ValidatorResult = {
	success: boolean
	isDisposable: boolean
}

/**
 * Checks if an email is disposable using debounce.io
 */
async function checkWithDebounce(email: string): Promise<ValidatorResult> {
	try {
		const response = await fetch(
			`https://disposable.debounce.io/?email=${encodeURIComponent(email)}`,
		)

		if (!response.ok) {
			console.error("Debounce.io API error:", response.status)
			return { success: false, isDisposable: false }
		}

		const data = (await response.json()) as DisposableEmailResponse

		return { success: true, isDisposable: data.disposable === "true" }
	} catch (error) {
		console.error("Failed to check disposable email with debounce.io:", error)
		return { success: false, isDisposable: false }
	}
}

/**
 * Checks if an email is disposable using mailcheck.ai
 */
async function checkWithMailcheck(email: string): Promise<ValidatorResult> {
	try {
		const response = await fetch(
			`https://api.mailcheck.ai/email/${encodeURIComponent(email)}`,
		)

		if (!response.ok) {
			console.error("Mailcheck.ai API error:", response.status)
			return { success: false, isDisposable: false }
		}

		const data = (await response.json()) as MailcheckResponse
		return { success: true, isDisposable: data.disposable }
	} catch (error) {
		console.error("Failed to check disposable email with mailcheck.ai:", error)
		return { success: false, isDisposable: false }
	}
}

/**
 * Checks if an email is allowed for sign up by verifying it's not a disposable email
 * Uses multiple services in sequence for redundancy.
 *
 * @throws {Error} If email is disposable or if all services fail
 */
export async function canSignUp({ email }: { email: string }): Promise<void> {
	// Skip disposable email check in development
	if (!isProd) {
		return
	}

	const validators = [checkWithDebounce, checkWithMailcheck]

	for (const validator of validators) {
		const result = await validator(email)

		// If the validator failed (network error, rate limit, etc), try the next one
		if (!result.success) {
			continue
		}

		// If we got a successful response and it's disposable, reject the signup
		if (result.isDisposable) {
			throw new Error("Disposable email addresses are not allowed")
		}

		// If we got a successful response and it's not disposable, allow the signup
		return
	}

	// If all validators failed, we can't verify the email
	throw new Error(
		"Unable to verify email address at this time. Please try again later.",
	)
}
