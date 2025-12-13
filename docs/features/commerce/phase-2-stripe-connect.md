# Phase 2: Stripe Connect Integration

**Goal**: Enable payouts to competition organizers
**Status**: Ready for Implementation
**Last Updated**: 2025-01-09

---

## Overview

Enable competition organizers to receive payouts directly from athlete registrations via Stripe Connect. Supports both Express accounts (quick onboarding) and Standard accounts (existing Stripe users).

### Business Rules

| Scenario | Behavior |
|----------|----------|
| No Stripe connected | Can only create FREE competitions ($0) |
| Stripe connected | Can set any price, receives immediate payouts |
| Stripe disconnected (had paid competitions) | Block new registrations on paid competitions until reconnected |
| Pricing UI access | Gated - shows "Connect Stripe" prompt if not connected |

### Account Types

| Type | Use Case | Onboarding |
|------|----------|------------|
| Express | New to Stripe, quick setup | Stripe-hosted flow, 5-10 min |
| Standard | Existing Stripe account | OAuth flow, connect existing account |

---

## Current State

### Schema (Already Implemented)

The following fields exist in `src/db/schemas/teams.ts` (lines 124-127):
```typescript
// Stripe Connect fields (Phase 2 prep for organizer payouts)
stripeConnectedAccountId: text(), // Stripe account ID (acct_xxx)
stripeAccountStatus: text({ length: 20 }), // NOT_CONNECTED | PENDING | VERIFIED
stripeOnboardingCompletedAt: integer({ mode: "timestamp" }),
```

### What Needs to Be Added

**Schema:**
```typescript
stripeAccountType: text({ length: 20 }), // 'express' | 'standard' | null
```

**Not Implemented:**
- Connected account creation/onboarding actions
- Multi-party payments with `transfer_data.destination`
- Stripe Connect webhooks (`account.updated`, `account.application.*`)
- Pricing page gating based on Stripe Connect status
- Registration blocking for disconnected accounts

---

## Implementation Phases

### Phase 2.1: Schema Update

**File:** `src/db/schemas/teams.ts`

Add after line 127:
```typescript
stripeAccountType: text({ length: 20 }), // 'express' | 'standard' | null
```

**Migration:** `pnpm db:generate add-stripe-account-type`

---

### Phase 2.2: Server Module

**New directory:** `src/server/stripe-connect/`

**File: `src/server/stripe-connect/accounts.ts`**
```typescript
import "server-only"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { teamTable } from "@/db/schema"
import { getStripe } from "@/lib/stripe"
import type Stripe from "stripe"

const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID

/**
 * Create an Express connected account for a team
 */
export async function createExpressAccount(
  teamId: string,
  email: string,
  teamName: string
): Promise<{ accountId: string; onboardingUrl: string }> {
  const db = getDb()
  const stripe = getStripe()

  // Create Express account
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: {
      teamId,
      teamName,
    },
  })

  // Save to database
  await db.update(teamTable)
    .set({
      stripeConnectedAccountId: account.id,
      stripeAccountStatus: "PENDING",
      stripeAccountType: "express",
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
export async function createExpressAccountLink(
  accountId: string,
  teamId: string
): Promise<{ url: string }> {
  const stripe = getStripe()
  const db = getDb()

  // Get team slug for return URLs
  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
    columns: { slug: true },
  })

  if (!team) {
    throw new Error("Team not found")
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/teams/${team.slug}/payouts?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/teams/${team.slug}/payouts?connected=true`,
    type: "account_onboarding",
  })

  return { url: accountLink.url }
}

/**
 * Get OAuth authorization URL for Standard account connection
 */
export function getOAuthAuthorizeUrl(teamId: string, teamSlug: string): string {
  if (!STRIPE_CLIENT_ID) {
    throw new Error("STRIPE_CLIENT_ID environment variable not configured")
  }

  const state = Buffer.from(JSON.stringify({ teamId, teamSlug })).toString("base64")
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/connect/callback`

  const params = new URLSearchParams({
    client_id: STRIPE_CLIENT_ID,
    state,
    scope: "read_write",
    response_type: "code",
    redirect_uri: redirectUri,
  })

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

/**
 * Handle OAuth callback - exchange code for account ID
 */
export async function handleOAuthCallback(
  code: string,
  state: string
): Promise<{ teamId: string; teamSlug: string; accountId: string }> {
  const stripe = getStripe()
  const db = getDb()

  // Decode state
  let stateData: { teamId: string; teamSlug: string }
  try {
    stateData = JSON.parse(Buffer.from(state, "base64").toString("utf-8"))
  } catch {
    throw new Error("Invalid OAuth state")
  }

  // Exchange code for account ID
  const response = await stripe.oauth.token({
    grant_type: "authorization_code",
    code,
  })

  if (!response.stripe_user_id) {
    throw new Error("Failed to get Stripe account ID from OAuth")
  }

  // Get account details to check status
  const account = await stripe.accounts.retrieve(response.stripe_user_id)
  const status = account.charges_enabled && account.payouts_enabled
    ? "VERIFIED"
    : "PENDING"

  // Update team
  await db.update(teamTable)
    .set({
      stripeConnectedAccountId: response.stripe_user_id,
      stripeAccountStatus: status,
      stripeAccountType: "standard",
      stripeOnboardingCompletedAt: status === "VERIFIED" ? new Date() : null,
    })
    .where(eq(teamTable.id, stateData.teamId))

  return {
    teamId: stateData.teamId,
    teamSlug: stateData.teamSlug,
    accountId: response.stripe_user_id,
  }
}

/**
 * Get current account status from Stripe API
 */
export async function getAccountStatus(accountId: string): Promise<{
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirements: Stripe.Account.Requirements | null
}> {
  const stripe = getStripe()
  const account = await stripe.accounts.retrieve(accountId)

  return {
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    requirements: account.requirements ?? null,
  }
}

/**
 * Sync account status from Stripe to database
 */
export async function syncAccountStatus(teamId: string): Promise<void> {
  const db = getDb()
  const stripe = getStripe()

  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
    columns: { stripeConnectedAccountId: true },
  })

  if (!team?.stripeConnectedAccountId) {
    return
  }

  const account = await stripe.accounts.retrieve(team.stripeConnectedAccountId)
  const status = account.charges_enabled && account.payouts_enabled
    ? "VERIFIED"
    : "PENDING"

  await db.update(teamTable)
    .set({
      stripeAccountStatus: status,
      stripeOnboardingCompletedAt: status === "VERIFIED" ? new Date() : null,
    })
    .where(eq(teamTable.id, teamId))
}

/**
 * Check if a team has a verified Stripe connection
 */
export async function isAccountVerified(teamId: string): Promise<boolean> {
  const db = getDb()

  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
    columns: { stripeAccountStatus: true },
  })

  return team?.stripeAccountStatus === "VERIFIED"
}

/**
 * Disconnect a Stripe account from a team
 */
export async function disconnectAccount(teamId: string): Promise<void> {
  const db = getDb()

  await db.update(teamTable)
    .set({
      stripeConnectedAccountId: null,
      stripeAccountStatus: null,
      stripeAccountType: null,
      stripeOnboardingCompletedAt: null,
    })
    .where(eq(teamTable.id, teamId))

  // Note: We don't revoke the OAuth token or delete the Express account
  // The organizer can reconnect if they want
}

/**
 * Get Stripe Express dashboard login link
 */
export async function getStripeDashboardLink(accountId: string): Promise<string> {
  const stripe = getStripe()
  const loginLink = await stripe.accounts.createLoginLink(accountId)
  return loginLink.url
}
```

**File: `src/server/stripe-connect/index.ts`**
```typescript
export {
  createExpressAccount,
  createExpressAccountLink,
  getOAuthAuthorizeUrl,
  handleOAuthCallback,
  getAccountStatus,
  syncAccountStatus,
  isAccountVerified,
  disconnectAccount,
  getStripeDashboardLink,
} from "./accounts"
```

---

### Phase 2.3: Server Actions

**New file:** `src/actions/stripe-connect.action.ts`

```typescript
"use server"

import { z } from "zod"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { teamTable } from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
  createExpressAccount,
  createExpressAccountLink,
  getOAuthAuthorizeUrl,
  syncAccountStatus,
  disconnectAccount,
  getStripeDashboardLink,
} from "@/server/stripe-connect"
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit"

/**
 * Start Express account onboarding
 * Creates account if needed, returns onboarding URL
 */
export async function initiateExpressOnboarding(input: { teamId: string }) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

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
      throw new Error("Team not found")
    }

    // If already has account, just create new onboarding link
    if (team.stripeConnectedAccountId) {
      const link = await createExpressAccountLink(
        team.stripeConnectedAccountId,
        team.id
      )
      return { onboardingUrl: link.url }
    }

    // Create new Express account
    const result = await createExpressAccount(
      team.id,
      session.user.email ?? "",
      team.name
    )

    return { onboardingUrl: result.onboardingUrl }
  }, RATE_LIMITS.DEFAULT)
}

/**
 * Start Standard account OAuth flow
 * Returns OAuth authorization URL
 */
export async function initiateStandardOAuth(input: { teamId: string }) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

    const db = getDb()
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, input.teamId),
      columns: { id: true, slug: true },
    })

    if (!team) {
      throw new Error("Team not found")
    }

    const authorizationUrl = getOAuthAuthorizeUrl(team.id, team.slug)
    return { authorizationUrl }
  }, RATE_LIMITS.DEFAULT)
}

/**
 * Refresh onboarding link for Express accounts
 */
export async function refreshOnboardingLink(input: { teamId: string }) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

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
      throw new Error("No Stripe account connected")
    }

    if (team.stripeAccountType !== "express") {
      throw new Error("Can only refresh onboarding for Express accounts")
    }

    const link = await createExpressAccountLink(
      team.stripeConnectedAccountId,
      team.id
    )

    return { onboardingUrl: link.url }
  }, RATE_LIMITS.DEFAULT)
}

/**
 * Get current Stripe connection status
 */
export async function getStripeConnectionStatus(input: { teamId: string }) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    // Only need to be a team member to view status
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
      throw new Error("Team not found")
    }

    // If pending, sync status from Stripe
    if (team.stripeConnectedAccountId && team.stripeAccountStatus === "PENDING") {
      await syncAccountStatus(input.teamId)
      // Re-fetch after sync
      const updated = await db.query.teamTable.findFirst({
        where: eq(teamTable.id, input.teamId),
        columns: {
          stripeAccountStatus: true,
          stripeOnboardingCompletedAt: true,
        },
      })
      return {
        isConnected: updated?.stripeAccountStatus === "VERIFIED",
        status: updated?.stripeAccountStatus ?? null,
        accountType: team.stripeAccountType,
        onboardingCompletedAt: updated?.stripeOnboardingCompletedAt,
      }
    }

    return {
      isConnected: team.stripeAccountStatus === "VERIFIED",
      status: team.stripeAccountStatus,
      accountType: team.stripeAccountType,
      onboardingCompletedAt: team.stripeOnboardingCompletedAt,
    }
  }, RATE_LIMITS.DEFAULT)
}

/**
 * Get Stripe dashboard link (Express accounts only)
 */
export async function getStripeDashboardUrl(input: { teamId: string }) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

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
      throw new Error("No Stripe account connected")
    }

    if (team.stripeAccountStatus !== "VERIFIED") {
      throw new Error("Stripe account not verified")
    }

    // Express accounts use login links, Standard accounts go to dashboard.stripe.com
    if (team.stripeAccountType === "express") {
      const url = await getStripeDashboardLink(team.stripeConnectedAccountId)
      return { dashboardUrl: url }
    }

    // Standard accounts - direct to Stripe dashboard
    return { dashboardUrl: "https://dashboard.stripe.com" }
  }, RATE_LIMITS.DEFAULT)
}

/**
 * Disconnect Stripe account from team
 */
export async function disconnectStripeAccount(input: { teamId: string }) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

    await disconnectAccount(input.teamId)

    return { success: true }
  }, RATE_LIMITS.DEFAULT)
}
```

---

### Phase 2.4: Webhook Handlers

**Update:** `src/app/api/webhooks/stripe/route.ts`

Add new case handlers to the switch statement:

```typescript
case "account.updated":
  await handleAccountUpdated(event.data.object as Stripe.Account)
  break

case "account.application.authorized":
  // Standard OAuth connection confirmed
  console.log("INFO: [Stripe Webhook] Account application authorized")
  break

case "account.application.deauthorized":
  await handleAccountDeauthorized(event.data.object as { account: string })
  break
```

Add handler functions:

```typescript
/**
 * Handle account.updated webhook - update team's Stripe status
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const db = getDb()

  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.stripeConnectedAccountId, account.id),
  })

  if (!team) {
    console.log(
      `INFO: [Stripe Webhook] No team found for account ${account.id}`
    )
    return
  }

  const status =
    account.charges_enabled && account.payouts_enabled ? "VERIFIED" : "PENDING"

  const updateData: Record<string, unknown> = {
    stripeAccountStatus: status,
    updatedAt: new Date(),
  }

  // Set onboarding completed timestamp when first verified
  if (status === "VERIFIED" && !team.stripeOnboardingCompletedAt) {
    updateData.stripeOnboardingCompletedAt = new Date()
  }

  await db
    .update(teamTable)
    .set(updateData)
    .where(eq(teamTable.id, team.id))

  console.log(
    `INFO: [Stripe Webhook] Updated team ${team.id} Stripe status to ${status}`
  )
}

/**
 * Handle account.application.deauthorized webhook - user disconnected from Stripe side
 */
async function handleAccountDeauthorized(data: { account: string }) {
  const db = getDb()

  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.stripeConnectedAccountId, data.account),
  })

  if (!team) {
    return
  }

  // Clear Stripe connection
  await db
    .update(teamTable)
    .set({
      stripeConnectedAccountId: null,
      stripeAccountStatus: null,
      stripeAccountType: null,
      stripeOnboardingCompletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(teamTable.id, team.id))

  console.log(
    `WARN: [Stripe Webhook] Team ${team.id} Stripe account deauthorized`
  )
}
```

---

### Phase 2.5: OAuth Callback Route

**New file:** `src/app/api/stripe/connect/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { handleOAuthCallback } from "@/server/stripe-connect"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const error = request.nextUrl.searchParams.get("error")
  const errorDescription = request.nextUrl.searchParams.get("error_description")

  // Handle OAuth errors
  if (error) {
    console.error(
      `ERROR: [Stripe OAuth] ${error}: ${errorDescription}`
    )
    // Decode state to get team slug for redirect
    try {
      const stateData = JSON.parse(Buffer.from(state ?? "", "base64").toString("utf-8"))
      return NextResponse.redirect(
        new URL(
          `/settings/teams/${stateData.teamSlug}/payouts?error=${encodeURIComponent(error)}`,
          process.env.NEXT_PUBLIC_APP_URL
        )
      )
    } catch {
      return NextResponse.redirect(
        new URL("/settings?error=oauth_failed", process.env.NEXT_PUBLIC_APP_URL)
      )
    }
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_oauth_params", process.env.NEXT_PUBLIC_APP_URL)
    )
  }

  try {
    const result = await handleOAuthCallback(code, state)

    return NextResponse.redirect(
      new URL(
        `/settings/teams/${result.teamSlug}/payouts?connected=true`,
        process.env.NEXT_PUBLIC_APP_URL
      )
    )
  } catch (err) {
    console.error("ERROR: [Stripe OAuth] Callback failed:", err)
    return NextResponse.redirect(
      new URL("/settings?error=oauth_exchange_failed", process.env.NEXT_PUBLIC_APP_URL)
    )
  }
}
```

---

### Phase 2.6: Team Settings UI

**New file:** `src/app/(settings)/settings/teams/[teamSlug]/payouts/page.tsx`

```typescript
import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { teamTable } from "@/db/schema"
import { requireTeamMembership } from "@/utils/team-auth"
import { PayoutsSettings } from "./_components/payouts-settings"

interface PayoutsPageProps {
  params: Promise<{ teamSlug: string }>
  searchParams: Promise<{ connected?: string; error?: string; refresh?: string }>
}

export async function generateMetadata({
  params,
}: PayoutsPageProps): Promise<Metadata> {
  const { teamSlug } = await params
  return {
    title: `Payouts - ${teamSlug}`,
    description: "Manage your Stripe payout settings",
  }
}

export default async function PayoutsPage({
  params,
  searchParams,
}: PayoutsPageProps) {
  const { teamSlug } = await params
  const { connected, error, refresh } = await searchParams

  const db = getDb()
  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.slug, teamSlug),
    columns: {
      id: true,
      name: true,
      slug: true,
      stripeConnectedAccountId: true,
      stripeAccountStatus: true,
      stripeAccountType: true,
      stripeOnboardingCompletedAt: true,
    },
  })

  if (!team) {
    notFound()
  }

  // Verify user has access to this team
  await requireTeamMembership(team.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Connect your Stripe account to receive payouts from competition registrations.
        </p>
      </div>

      <PayoutsSettings
        team={{
          id: team.id,
          name: team.name,
          slug: team.slug,
          stripeAccountStatus: team.stripeAccountStatus,
          stripeAccountType: team.stripeAccountType,
          stripeOnboardingCompletedAt: team.stripeOnboardingCompletedAt,
        }}
        showConnectedMessage={connected === "true"}
        showRefreshMessage={refresh === "true"}
        errorMessage={error}
      />
    </div>
  )
}
```

**New file:** `src/app/(settings)/settings/teams/[teamSlug]/payouts/_components/payouts-settings.tsx`

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  AlertCircle,
  Unlink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  initiateExpressOnboarding,
  initiateStandardOAuth,
  refreshOnboardingLink,
  getStripeDashboardUrl,
  disconnectStripeAccount,
} from "@/actions/stripe-connect.action"

interface Props {
  team: {
    id: string
    name: string
    slug: string
    stripeAccountStatus: string | null
    stripeAccountType: string | null
    stripeOnboardingCompletedAt: Date | null
  }
  showConnectedMessage?: boolean
  showRefreshMessage?: boolean
  errorMessage?: string
}

export function PayoutsSettings({
  team,
  showConnectedMessage,
  showRefreshMessage,
  errorMessage,
}: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const isConnected = team.stripeAccountStatus === "VERIFIED"
  const isPending = team.stripeAccountStatus === "PENDING"
  const isNotConnected = !team.stripeAccountStatus

  const handleExpressOnboarding = async () => {
    setIsLoading("express")
    try {
      const result = await initiateExpressOnboarding({ teamId: team.id })
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start onboarding")
      setIsLoading(null)
    }
  }

  const handleStandardOAuth = async () => {
    setIsLoading("standard")
    try {
      const result = await initiateStandardOAuth({ teamId: team.id })
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start OAuth")
      setIsLoading(null)
    }
  }

  const handleRefreshLink = async () => {
    setIsLoading("refresh")
    try {
      const result = await refreshOnboardingLink({ teamId: team.id })
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh link")
      setIsLoading(null)
    }
  }

  const handleViewDashboard = async () => {
    setIsLoading("dashboard")
    try {
      const result = await getStripeDashboardUrl({ teamId: team.id })
      if (result.dashboardUrl) {
        window.open(result.dashboardUrl, "_blank")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get dashboard link")
    } finally {
      setIsLoading(null)
    }
  }

  const handleDisconnect = async () => {
    setIsLoading("disconnect")
    try {
      await disconnectStripeAccount({ teamId: team.id })
      toast.success("Stripe account disconnected")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect")
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {showConnectedMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Stripe Connected!</AlertTitle>
          <AlertDescription>
            Your Stripe account is now connected. You can accept paid registrations for your competitions.
          </AlertDescription>
        </Alert>
      )}

      {showRefreshMessage && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Complete Your Setup</AlertTitle>
          <AlertDescription>
            Your onboarding link expired. Click below to continue setting up your Stripe account.
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Failed</AlertTitle>
          <AlertDescription>
            {errorMessage === "access_denied"
              ? "You declined the Stripe connection request."
              : `Error: ${errorMessage}`}
          </AlertDescription>
        </Alert>
      )}

      {/* Connected State */}
      {isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>Stripe Connected</CardTitle>
            </div>
            <CardDescription>
              Your {team.stripeAccountType === "express" ? "Express" : "Standard"} Stripe account is connected and ready to receive payouts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleViewDashboard}
                disabled={isLoading === "dashboard"}
              >
                {isLoading === "dashboard" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                View Stripe Dashboard
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive">
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Stripe Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will prevent you from accepting paid registrations for your competitions. 
                      Any active paid competitions will stop accepting new registrations until you reconnect.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isLoading === "disconnect" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {team.stripeOnboardingCompletedAt && (
              <p className="text-xs text-muted-foreground">
                Connected on{" "}
                {new Date(team.stripeOnboardingCompletedAt).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending State */}
      {isPending && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
              <CardTitle>Complete Your Setup</CardTitle>
            </div>
            <CardDescription>
              Your Stripe account setup is incomplete. Continue onboarding to start receiving payouts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefreshLink} disabled={isLoading === "refresh"}>
              {isLoading === "refresh" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Continue Setup
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Not Connected State */}
      {isNotConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Connect Stripe</CardTitle>
            </div>
            <CardDescription>
              Connect your Stripe account to receive payouts from competition registrations.
              Choose how you'd like to connect:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Express Account Option */}
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Create New Account</CardTitle>
                  <CardDescription className="text-sm">
                    Quick 5-10 minute setup with Stripe Express
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleExpressOnboarding}
                    disabled={isLoading === "express"}
                    className="w-full"
                  >
                    {isLoading === "express" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Get Started
                  </Button>
                </CardContent>
              </Card>

              {/* Standard Account Option */}
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Connect Existing</CardTitle>
                  <CardDescription className="text-sm">
                    Already have a Stripe account? Connect it here
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={handleStandardOAuth}
                    disabled={isLoading === "standard"}
                    className="w-full"
                  >
                    {isLoading === "standard" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Connect Account
                  </Button>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              You can always create free competitions without connecting Stripe.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

---

### Phase 2.7: Pricing UI Gating

**Update:** `src/app/(compete)/compete/organizer/[competitionId]/(with-tabs)/pricing/page.tsx`

Add check before rendering form:

```typescript
// Get organizing team's Stripe connection status
const organizingTeam = await db.query.teamTable.findFirst({
  where: eq(teamTable.id, competition.organizingTeamId),
  columns: {
    slug: true,
    stripeAccountStatus: true,
  },
})

const isStripeConnected = organizingTeam?.stripeAccountStatus === "VERIFIED"

if (!isStripeConnected) {
  return (
    <StripeConnectionRequired
      teamSlug={organizingTeam?.slug ?? ""}
      competitionName={competition.name}
    />
  )
}
```

**New file:** `src/app/(compete)/compete/organizer/[competitionId]/(with-tabs)/pricing/_components/stripe-connection-required.tsx`

```typescript
"use client"

import Link from "next/link"
import { CreditCard, ExternalLink, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Props {
  teamSlug: string
  competitionName: string
}

export function StripeConnectionRequired({ teamSlug, competitionName }: Props) {
  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Stripe Connection Required</AlertTitle>
        <AlertDescription>
          Connect your Stripe account to charge registration fees for {competitionName}.
          Free registrations ($0) are always available.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Connect Stripe to Accept Payments</CardTitle>
          <CardDescription>
            To charge registration fees for your competition, you need to connect 
            your Stripe account. This allows you to receive payouts directly from 
            athlete registrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button asChild>
            <Link href={`/settings/teams/${teamSlug}/payouts`}>
              Set Up Payouts
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-xs text-center text-muted-foreground max-w-md">
            You'll be able to set registration fees after connecting Stripe. 
            Free registrations work without a Stripe connection.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

### Phase 2.8: Commerce Integration

**Update:** `src/actions/commerce.action.ts`

In `initiateRegistrationPayment()`, modify checkout session creation:

```typescript
// Get organizing team's Stripe connection
const organizingTeam = await db.query.teamTable.findFirst({
  where: eq(teamTable.id, competition.organizingTeamId),
  columns: {
    stripeConnectedAccountId: true,
    stripeAccountStatus: true,
  },
})

// Build checkout session params
const sessionParams: Stripe.Checkout.SessionCreateParams = {
  mode: "payment",
  payment_method_types: ["card"],
  line_items: [/* existing config */],
  metadata: {/* existing metadata */},
  success_url: /* existing */,
  cancel_url: /* existing */,
  expires_at: /* existing */,
  customer_email: /* existing */,
}

// Add transfer_data if organizer has verified Stripe connection
if (
  organizingTeam?.stripeConnectedAccountId &&
  organizingTeam.stripeAccountStatus === "VERIFIED"
) {
  sessionParams.payment_intent_data = {
    application_fee_amount: feeBreakdown.platformFeeCents,
    transfer_data: {
      destination: organizingTeam.stripeConnectedAccountId,
    },
  }
}

const checkoutSession = await getStripe().checkout.sessions.create(sessionParams)
```

---

### Phase 2.9: Registration Gating

**Update:** `src/actions/commerce.action.ts`

Add early check in `initiateRegistrationPayment()`:

```typescript
// For paid competitions, verify organizer has Stripe connected
if (registrationFeeCents > 0) {
  const organizingTeam = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, competition.organizingTeamId),
    columns: { stripeAccountStatus: true },
  })

  if (organizingTeam?.stripeAccountStatus !== "VERIFIED") {
    throw new Error(
      "This competition is temporarily unable to accept paid registrations. " +
      "Please contact the organizer."
    )
  }
}
```

---

### Phase 2.10: Revenue Dashboard Updates

**Update:** `src/app/(compete)/compete/organizer/[competitionId]/(with-tabs)/revenue/page.tsx`

Add Stripe status to props:

```typescript
const organizingTeam = await db.query.teamTable.findFirst({
  where: eq(teamTable.id, competition.organizingTeamId),
  columns: {
    slug: true,
    stripeAccountStatus: true,
  },
})

return (
  <RevenueStatsDisplay
    stats={stats}
    stripeStatus={{
      isConnected: organizingTeam?.stripeAccountStatus === "VERIFIED",
      teamSlug: organizingTeam?.slug ?? "",
    }}
  />
)
```

**Update:** `revenue/_components/revenue-stats-display.tsx`

Add payout status banner:

```typescript
interface RevenueStatsDisplayProps {
  stats: CompetitionRevenueStats
  stripeStatus?: {
    isConnected: boolean
    teamSlug: string
  }
}

// Add at top of component render:
{stripeStatus && !stripeStatus.isConnected && (
  <Alert variant="warning" className="mb-6">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Payouts Not Set Up</AlertTitle>
    <AlertDescription>
      Connect your Stripe account to receive payouts for registrations.{" "}
      <Link
        href={`/settings/teams/${stripeStatus.teamSlug}/payouts`}
        className="font-medium underline"
      >
        Set up payouts →
      </Link>
    </AlertDescription>
  </Alert>
)}
```

---

## Environment Variables

```env
# Existing
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# New for Standard OAuth
STRIPE_CLIENT_ID=ca_xxx  # From Stripe Dashboard → Connect → Settings
```

---

## Webhook Configuration Guide

### 1. Enable Stripe Connect

1. Go to Stripe Dashboard → Settings → Connect
2. Complete platform profile setup
3. Enable Express accounts

### 2. Configure OAuth (Standard Accounts)

1. Go to Settings → Connect → OAuth
2. Add redirect URI: `https://yourdomain.com/api/stripe/connect/callback`
3. Copy Client ID to `STRIPE_CLIENT_ID` env var

### 3. Configure Webhooks

1. Go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed` (existing)
   - `checkout.session.expired` (existing)
   - `account.updated` (new)
   - `account.application.authorized` (new)
   - `account.application.deauthorized` (new)

4. **Important**: For connected account events, you need to listen to events from connected accounts:
   - Check "Listen to events on connected accounts" option
   - Or create a separate endpoint for Connect webhooks

### 4. Testing

1. Use Stripe Test Mode
2. Create test Express accounts via onboarding flow
3. Test Standard OAuth with your own test Stripe account
4. Use Stripe CLI for local webhook testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

---

## Implementation Checklist

### Phase 2.1 - Schema
- [x] Add `stripeAccountType` field to teams table
- [x] Run migration: `pnpm db:generate add-stripe-account-type`
- [x] Apply migration: `pnpm db:migrate:dev`

### Phase 2.2 - Server Module
- [x] Create `src/server/stripe-connect/accounts.ts`
- [x] Create `src/server/stripe-connect/index.ts`

### Phase 2.3 - Actions
- [x] Create `src/actions/stripe-connect.action.ts`

### Phase 2.4 - Webhooks
- [x] Add `account.updated` handler
- [x] Add `account.application.deauthorized` handler

### Phase 2.5 - OAuth Callback
- [x] Create `src/app/api/stripe/connect/callback/route.ts`

### Phase 2.6 - Team Settings UI
- [x] Create `/settings/teams/[teamSlug]/payouts/page.tsx`
- [x] Create `payouts/_components/payouts-settings.tsx`

### Phase 2.7 - Pricing Gating
- [x] Update pricing page to check Stripe status
- [x] Create `stripe-connection-required.tsx` component

### Phase 2.8 - Commerce Integration
- [x] Add `transfer_data` to checkout session creation

### Phase 2.9 - Registration Gating
- [x] Add Stripe connection check for paid registrations

### Phase 2.10 - Revenue Dashboard
- [x] Add Stripe status to revenue page
- [x] Add payout status banner

### Environment & Testing
- [ ] Add `STRIPE_CLIENT_ID` environment variable
- [ ] Configure Connect webhooks in Stripe Dashboard
- [ ] Test Express onboarding flow
- [ ] Test Standard OAuth flow
- [ ] Test payment with connected account
