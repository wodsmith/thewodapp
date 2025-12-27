/**
 * Stripe Connect Server Functions for TanStack Start
 * Handles Stripe Connect account onboarding and management
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {eq} from 'drizzle-orm'
import {setCookie} from '@tanstack/react-start/server'
import {getDb} from '@/db'
import {TEAM_PERMISSIONS, teamTable} from '@/db/schema'
import {getStripe} from '@/lib/stripe'
import {requireVerifiedEmail} from '@/utils/auth'
import isProd from '@/utils/is-prod'
import {requireTeamMembership} from './requireTeamMembership'
import {requireTeamPermission} from '@/utils/team-auth'

// ============================================================================
// Constants
// ============================================================================

/** Cookie name for OAuth state CSRF token */
export const STRIPE_OAUTH_STATE_COOKIE_NAME = 'stripe_oauth_state'

// ============================================================================
// Stripe Connect Helpers (ported from wodsmith)
// ============================================================================

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://thewodapp.com'
}

function getStripeClientId(): string | undefined {
  return process.env.STRIPE_CLIENT_ID
}

/**
 * OAuth state payload structure for Stripe Connect
 */
export interface StripeOAuthState {
  teamId: string
  teamSlug: string
  userId: string
  csrfToken: string
}

/**
 * Parse and validate the OAuth state parameter
 * Exported for use in OAuth callback API route
 */
export function parseOAuthState(state: string): StripeOAuthState {
  try {
    const decoded = JSON.parse(
      Buffer.from(state, 'base64').toString('utf-8'),
    ) as unknown
    // Type guard and validate required fields
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('teamId' in decoded) ||
      !('teamSlug' in decoded) ||
      !('userId' in decoded) ||
      !('csrfToken' in decoded)
    ) {
      throw new Error('Missing required fields in OAuth state')
    }
    return decoded as StripeOAuthState
  } catch {
    throw new Error('Invalid OAuth state')
  }
}

/**
 * Generate a random state token for CSRF protection
 */
function generateOAuthState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

/**
 * Get OAuth authorization URL for Standard account connection
 */
function getOAuthAuthorizeUrl(
  teamId: string,
  teamSlug: string,
  userId: string,
  csrfToken: string,
): string {
  const clientId = getStripeClientId()
  if (!clientId) {
    throw new Error('STRIPE_CLIENT_ID environment variable not configured')
  }

  const statePayload: StripeOAuthState = {teamId, teamSlug, userId, csrfToken}
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64')
  const appUrl = getAppUrl()
  const redirectUri = `${appUrl}/api/stripe/connect/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    state,
    scope: 'read_write',
    response_type: 'code',
    redirect_uri: redirectUri,
  })

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

/**
 * Create an Express connected account for a team
 */
async function createExpressAccount(
  teamId: string,
  email: string,
  teamName: string,
): Promise<{accountId: string; onboardingUrl: string}> {
  const db = getDb()
  const stripe = getStripe()

  // Create Express account
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email,
    capabilities: {
      transfers: {requested: true},
    },
    business_type: 'individual',
    metadata: {
      teamId,
      teamName,
    },
  })

  // Save to database
  await db
    .update(teamTable)
    .set({
      stripeConnectedAccountId: account.id,
      stripeAccountStatus: 'PENDING',
      stripeAccountType: 'express',
    })
    .where(eq(teamTable.id, teamId))

  // Create onboarding link
  const accountLink = await createExpressAccountLink(account.id, teamId)

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  }
}

/**
 * Create/refresh an Express account onboarding link
 */
async function createExpressAccountLink(
  accountId: string,
  teamId: string,
): Promise<{url: string}> {
  const stripe = getStripe()
  const db = getDb()

  // Get team slug for return URLs
  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
    columns: {slug: true},
  })

  if (!team) {
    throw new Error('Team not found')
  }

  const appUrl = getAppUrl()
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/compete/organizer/settings/payouts/${team.slug}?stripe_refresh=true`,
    return_url: `${appUrl}/compete/organizer/settings/payouts/${team.slug}?stripe_connected=true`,
    type: 'account_onboarding',
  })

  return {url: accountLink.url}
}

// /**
//  * Handle OAuth callback - exchange code for account ID
//  * Exported for use in OAuth callback API route
//  *
//  * @param code - The authorization code from Stripe
//  * @param state - The state parameter containing teamId, teamSlug, userId, csrfToken
//  * @returns Object with teamId, teamSlug, accountId, and status
//  */
// export async function handleOAuthCallback(
//   code: string,
//   state: string,
// ): Promise<{
//   teamId: string
//   teamSlug: string
//   accountId: string
//   status: 'VERIFIED' | 'PENDING'
// }> {
//   const stripe = getStripe()
//   const db = getDb()

//   // Decode state - now includes userId and csrfToken for security
//   const stateData = parseOAuthState(state)

//   // Exchange code for account ID
//   const response = await stripe.oauth.token({
//     grant_type: 'authorization_code',
//     code,
//   })

//   if (!response.stripe_user_id) {
//     throw new Error('Failed to get Stripe account ID from OAuth')
//   }

//   // Get account details to check status
//   const account = await stripe.accounts.retrieve(response.stripe_user_id)
//   const status =
//     account.charges_enabled && account.payouts_enabled ? 'VERIFIED' : 'PENDING'

//   console.log('[Stripe OAuth] Account status check:', {
//     accountId: response.stripe_user_id,
//     chargesEnabled: account.charges_enabled,
//     payoutsEnabled: account.payouts_enabled,
//     detailsSubmitted: account.details_submitted,
//     status,
//     teamId: stateData.teamId,
//   })

//   // Update team
//   await db
//     .update(teamTable)
//     .set({
//       stripeConnectedAccountId: response.stripe_user_id,
//       stripeAccountStatus: status,
//       stripeAccountType: 'standard',
//       stripeOnboardingCompletedAt: status === 'VERIFIED' ? new Date() : null,
//     })
//     .where(eq(teamTable.id, stateData.teamId))

//   return {
//     teamId: stateData.teamId,
//     teamSlug: stateData.teamSlug,
//     accountId: response.stripe_user_id,
//     status,
//   }
// }

/**
 * Sync account status from Stripe to database
 */
async function syncStripeAccountStatusInternal(teamId: string): Promise<void> {
  const db = getDb()
  const stripe = getStripe()

  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
    columns: {
      stripeConnectedAccountId: true,
      stripeOnboardingCompletedAt: true,
    },
  })

  if (!team?.stripeConnectedAccountId) {
    return
  }

  const account = await stripe.accounts.retrieve(team.stripeConnectedAccountId)
  const status =
    account.charges_enabled && account.payouts_enabled ? 'VERIFIED' : 'PENDING'

  // Only set onboarding timestamp if not already set and status is VERIFIED
  const updateData: {
    stripeAccountStatus: string
    stripeOnboardingCompletedAt?: Date | null
  } = {
    stripeAccountStatus: status,
  }

  if (status === 'VERIFIED' && !team.stripeOnboardingCompletedAt) {
    updateData.stripeOnboardingCompletedAt = new Date()
  }

  await db.update(teamTable).set(updateData).where(eq(teamTable.id, teamId))
}

/**
 * Disconnect a Stripe account from a team
 */
async function disconnectAccountInternal(teamId: string): Promise<void> {
  const db = getDb()

  await db
    .update(teamTable)
    .set({
      stripeConnectedAccountId: null,
      stripeAccountStatus: null,
      stripeAccountType: null,
      stripeOnboardingCompletedAt: null,
    })
    .where(eq(teamTable.id, teamId))
}

/**
 * Get Stripe Express dashboard login link
 */
async function getStripeDashboardLinkInternal(
  accountId: string,
): Promise<string> {
  const stripe = getStripe()
  const loginLink = await stripe.accounts.createLoginLink(accountId)
  return loginLink.url
}

/**
 * Balance amounts by currency
 */
interface BalanceAmount {
  currency: string
  amount: number
}

/**
 * Connected account balance summary
 */
export interface AccountBalance {
  available: BalanceAmount[]
  pending: BalanceAmount[]
}

/**
 * Get the balance for a connected account
 */
async function getAccountBalanceInternal(
  accountId: string,
): Promise<AccountBalance> {
  const stripe = getStripe()

  const balance = await stripe.balance.retrieve({
    stripeAccount: accountId,
  })

  return {
    available: balance.available.map((b) => ({
      currency: b.currency,
      amount: b.amount,
    })),
    pending: balance.pending.map((b) => ({
      currency: b.currency,
      amount: b.amount,
    })),
  }
}

// ============================================================================
// Input Schemas
// ============================================================================

const teamIdInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get current Stripe connection status
 */
export const getStripeConnectionStatusFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}) => {
    // Verify user is a member of this team
    await requireTeamMembership(input.teamId)
    const db = getDb()
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, input.teamId),
      columns: {
        stripeConnectedAccountId: true,
        stripeAccountStatus: true,
        stripeAccountType: true,
        stripeOnboardingCompletedAt: true,
      },
    })

    if (!team) {
      throw new Error('Team not found')
    }
    // If pending, sync status from Stripe
    if (
      team.stripeConnectedAccountId &&
      team.stripeAccountStatus === 'PENDING'
    ) {
      await syncStripeAccountStatusInternal(input.teamId)
      // Re-fetch after sync
      const updated = await db.query.teamTable.findFirst({
        where: eq(teamTable.id, input.teamId),
        columns: {
          stripeAccountStatus: true,
          stripeOnboardingCompletedAt: true,
        },
      })
      return {
        isConnected: updated?.stripeAccountStatus === 'VERIFIED',
        status: updated?.stripeAccountStatus ?? null,
        accountType: team.stripeAccountType,
        onboardingCompletedAt: updated?.stripeOnboardingCompletedAt,
      }
    }
    return {
      isConnected: team.stripeAccountStatus === 'VERIFIED',
      status: team.stripeAccountStatus,
      accountType: team.stripeAccountType,
      onboardingCompletedAt: team.stripeOnboardingCompletedAt,
    }
  })

/**
 * Start Express account onboarding
 * Creates account if needed, returns onboarding URL
 */
export const initiateExpressOnboardingFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error('Unauthorized')

    await requireTeamPermission(
      input.teamId,
      TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
    )

    const db = getDb()
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, input.teamId),
      columns: {
        id: true,
        name: true,
        slug: true,
        stripeConnectedAccountId: true,
        stripeAccountStatus: true,
      },
    })

    if (!team) {
      throw new Error('Team not found')
    }

    // If already has account, just create new onboarding link
    if (team.stripeConnectedAccountId) {
      const link = await createExpressAccountLink(
        team.stripeConnectedAccountId,
        team.id,
      )
      return {onboardingUrl: link.url}
    }

    // Create new Express account
    const result = await createExpressAccount(
      team.id,
      session.user.email ?? '',
      team.name,
    )

    return {onboardingUrl: result.onboardingUrl}
  })

/**
 * Start Standard account OAuth flow
 * Returns OAuth authorization URL
 *
 * Security: Stores a CSRF state token in a cookie and includes userId in the
 * state parameter. The callback validates both to prevent:
 * 1. CSRF attacks (state token must match cookie)
 * 2. Unauthorized team modifications (userId must match session)
 */
export const initiateStandardOAuthFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error('Unauthorized')

    await requireTeamPermission(
      input.teamId,
      TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
    )

    const db = getDb()
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, input.teamId),
      columns: {id: true, slug: true},
    })

    if (!team) {
      throw new Error('Team not found')
    }

    // Generate CSRF state token
    const csrfState = generateOAuthState()

    // Store CSRF state in a cookie for validation on callback
    setCookie(STRIPE_OAUTH_STATE_COOKIE_NAME, csrfState, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      maxAge: 10 * 60, // 10 minutes in seconds
      sameSite: 'lax', // Must be "lax" for OAuth redirects to work
    })

    // Include userId in state for authorization validation on callback
    const authorizationUrl = getOAuthAuthorizeUrl(
      team.id,
      team.slug,
      session.userId,
      csrfState,
    )

    return {authorizationUrl}
  })

/**
 * Refresh onboarding link for Express accounts
 */
export const refreshOnboardingLinkFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error('Unauthorized')

    await requireTeamPermission(
      input.teamId,
      TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
    )

    const db = getDb()
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, input.teamId),
      columns: {
        id: true,
        stripeConnectedAccountId: true,
        stripeAccountType: true,
      },
    })

    if (!team?.stripeConnectedAccountId) {
      throw new Error('No Stripe account connected')
    }

    if (team.stripeAccountType !== 'express') {
      throw new Error('Can only refresh onboarding for Express accounts')
    }

    const link = await createExpressAccountLink(
      team.stripeConnectedAccountId,
      team.id,
    )

    return {onboardingUrl: link.url}
  })

/**
 * Sync Stripe account status from Stripe API
 */
export const syncStripeAccountStatusFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}) => {
    await requireTeamMembership(input.teamId)

    await syncStripeAccountStatusInternal(input.teamId)

    return {success: true}
  })

/**
 * Disconnect Stripe account from team
 */
export const disconnectStripeAccountFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error('Unauthorized')

    await requireTeamPermission(
      input.teamId,
      TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
    )

    await disconnectAccountInternal(input.teamId)

    return {success: true}
  })

/**
 * Get Stripe dashboard URL (Express accounts only)
 */
export const getStripeDashboardUrlFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error('Unauthorized')

    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.ACCESS_BILLING)

    const db = getDb()
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, input.teamId),
      columns: {
        stripeConnectedAccountId: true,
        stripeAccountType: true,
        stripeAccountStatus: true,
      },
    })

    if (!team?.stripeConnectedAccountId) {
      throw new Error('No Stripe account connected')
    }

    if (team.stripeAccountStatus !== 'VERIFIED') {
      throw new Error('Stripe account not verified')
    }

    // Express accounts use login links, Standard accounts go to dashboard.stripe.com
    if (team.stripeAccountType === 'express') {
      const url = await getStripeDashboardLinkInternal(
        team.stripeConnectedAccountId,
      )
      return {dashboardUrl: url}
    }

    // Standard accounts - direct to Stripe dashboard
    return {dashboardUrl: 'https://dashboard.stripe.com'}
  })

/**
 * Get connected account balance from Stripe
 */
export const getStripeAccountBalanceFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => teamIdInputSchema.parse(data))
  .handler(async ({data: input}): Promise<AccountBalance | null> => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error('Unauthorized')

    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.ACCESS_BILLING)

    const db = getDb()
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, input.teamId),
      columns: {
        stripeConnectedAccountId: true,
        stripeAccountStatus: true,
      },
    })

    if (!team?.stripeConnectedAccountId) {
      return null
    }

    if (team.stripeAccountStatus !== 'VERIFIED') {
      return null
    }

    return getAccountBalanceInternal(team.stripeConnectedAccountId)
  })
