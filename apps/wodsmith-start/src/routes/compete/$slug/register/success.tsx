import {createFileRoute, Link, redirect} from '@tanstack/react-router'
import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Receipt,
  Users,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Separator} from '@/components/ui/separator'
import {GENDER_ENUM, type Gender} from '@/db/schema'
import {getCompetitionBySlugFn} from '@/server-fns/competition-fns'
import {getUserCompetitionRegistrationFn} from '@/server-fns/competition-detail-fns'
import {CopyInviteLink} from '@/components/registration/copy-invite-link'
import {ProfileCompletionForm} from '@/components/registration/profile-completion-form'

// ============================================================================
// Server Functions
// ============================================================================

const updateAthleteProfileInputSchema = z.object({
  gender: z.enum([GENDER_ENUM.MALE, GENDER_ENUM.FEMALE]),
  dateOfBirth: z.date(),
  affiliateName: z.string().min(1),
})

/**
 * Update athlete profile (gender, dateOfBirth, affiliateName)
 */
const updateAthleteProfileFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    updateAthleteProfileInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const {getSessionFromCookie} = await import('@/utils/auth')
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Unauthorized')
    }

    const {getDb} = await import('@/db')
    const {userTable} = await import('@/db/schema')
    const {eq} = await import('drizzle-orm')

    const db = getDb()

    await db
      .update(userTable)
      .set({
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        affiliateName: data.affiliateName,
      })
      .where(eq(userTable.id, session.userId))

    return {success: true}
  })

/**
 * Server function to load registration success page data
 */
const getRegistrationSuccessDataFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string(),
        userId: z.string(),
        sessionId: z.string().optional(),
        registrationId: z.string().optional(),
        commercePurchaseId: z.string().optional(),
        athleteTeamId: z.string().optional(),
        passStripeFeesToCustomer: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({data}) => {
    const {getDb} = await import('@/db')
    const {userTable, commercePurchaseTable, teamInvitationTable} =
      await import('@/db/schema')
    const {eq} = await import('drizzle-orm')
    // Local stripe utility (no server-only import for TanStack Start compatibility)
    const {getStripe} = await import('@/lib/stripe')

    const db = getDb()

    // Get user profile to check if complete
    const user = await db.query.userTable.findFirst({
      where: eq(userTable.id, data.userId),
    })

    const isProfileComplete =
      user?.gender && user?.dateOfBirth && user?.affiliateName

    // Fetch checkout session details if session_id provided
    let checkoutSession: Awaited<
      ReturnType<
        ReturnType<typeof getStripe>['checkout']['sessions']['retrieve']
      >
    > | null = null

    if (data.sessionId) {
      try {
        checkoutSession = await getStripe().checkout.sessions.retrieve(
          data.sessionId,
          {
            expand: ['line_items', 'payment_intent'],
          },
        )
      } catch {
        // Session not found or invalid - continue without payment details
      }
    }

    // Fetch purchase record for fee breakdown
    let purchase: typeof commercePurchaseTable.$inferSelect | null = null
    if (data.commercePurchaseId) {
      purchase =
        (await db.query.commercePurchaseTable.findFirst({
          where: eq(commercePurchaseTable.id, data.commercePurchaseId),
        })) ?? null
    }

    // Fetch team invitations if this is a team registration
    let teamInvites: Array<{
      id: string
      email: string
      token: string
      acceptedAt: Date | null
      expiresAt: Date
    }> = []

    if (data.athleteTeamId) {
      const invites = await db.query.teamInvitationTable.findMany({
        where: eq(teamInvitationTable.teamId, data.athleteTeamId),
      })
      teamInvites = invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        token: inv.token,
        acceptedAt: inv.acceptedAt,
        expiresAt: inv.expiresAt,
      }))
    }

    return {
      user,
      isProfileComplete,
      checkoutSession,
      purchase,
      teamInvites,
    }
  })

/**
 * Refresh button component
 */
function RefreshButton() {
  return (
    <Button
      variant="ghost"
      onClick={() => window.location.reload()}
      className="text-sm"
    >
      Refresh Page
    </Button>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute('/compete/$slug/register/success')({
  component: RegistrationSuccessPage,
  validateSearch: z.object({
    session_id: z.string().optional(),
  }),
  loaderDeps: ({search}) => ({session_id: search.session_id}),
  loader: async ({params, context, deps}) => {
    const {slug} = params
    const {session_id} = deps
    const session = context?.session ?? null

    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: {redirect: `/compete/${slug}`},
      })
    }

    // Get competition
    const {competition} = await getCompetitionBySlugFn({data: {slug}})
    if (!competition) {
      throw redirect({to: '/compete'})
    }

    // Check for registration
    const {registration} = await getUserCompetitionRegistrationFn({
      data: {
        competitionId: competition.id,
        userId: session.userId,
      },
    })

    // Check if competition passes Stripe fees to customer
    const passStripeFeesToCustomer =
      competition.passStripeFeesToCustomer ?? false

    // Get the base URL for invite links
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thewodapp.com'

    // Fetch additional data via server function (avoids client-side db import)
    const {user, isProfileComplete, checkoutSession, purchase, teamInvites} =
      await getRegistrationSuccessDataFn({
        data: {
          competitionId: competition.id,
          userId: session.userId,
          sessionId: session_id,
          registrationId: registration?.id,
          commercePurchaseId:
            (registration as {commercePurchaseId?: string})
              ?.commercePurchaseId ?? undefined,
          athleteTeamId: registration?.athleteTeamId ?? undefined,
          passStripeFeesToCustomer,
        },
      })

    return {
      competition,
      registration,
      user,
      isProfileComplete,
      checkoutSession,
      purchase,
      passStripeFeesToCustomer,
      teamInvites,
      baseUrl,
      slug,
    }
  },
})

function RegistrationSuccessPage() {
  const {
    competition,
    registration,
    user,
    isProfileComplete,
    checkoutSession,
    purchase,
    passStripeFeesToCustomer,
    teamInvites,
    baseUrl,
    slug,
  } = Route.useLoaderData()

  const handleProfileUpdate = async (values: {
    gender: Gender
    dateOfBirth: Date
    affiliateName: string
  }) => {
    await updateAthleteProfileFn({data: values})
  }

  if (!registration) {
    // Payment may still be processing (webhook hasn't completed yet)
    return (
      <div className="mx-auto max-w-lg py-12 px-4">
        <Card>
          <CardHeader className="text-center">
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <CardTitle className="text-2xl">
              Processing Your Registration...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Your payment was successful! We&apos;re finalizing your
              registration.
            </p>
            <p className="text-sm text-muted-foreground">
              This usually takes just a few seconds. You&apos;ll receive a
              confirmation email shortly.
            </p>
            <div className="pt-4 flex flex-col gap-2">
              <Button variant="outline" asChild>
                <Link to="/compete/$slug" params={{slug}}>
                  Back to Competition
                </Link>
              </Button>
              <RefreshButton />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Registration found - show success
  return (
    <div className="mx-auto max-w-lg py-12 px-4 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Registration Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p>
            You&apos;re registered for <strong>{competition.name}</strong>
          </p>

          {registration.teamName && (
            <p className="text-muted-foreground">
              Team: <strong>{registration.teamName}</strong>
            </p>
          )}

          <div className="pt-4">
            <Button asChild>
              <Link to="/compete/$slug" params={{slug}}>
                View Competition
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Info with Invite Links */}
      {registration.athleteTeamId && teamInvites.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Your Team</CardTitle>
            </div>
            <CardDescription>
              {registration.teamName || 'Your Team'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share these invite links with your teammates so they can join your
              team.
            </p>

            <div className="space-y-3">
              {teamInvites.map((invite) => {
                const inviteUrl = `${baseUrl}/compete/invite/${invite.token}`
                const isAccepted = !!invite.acceptedAt
                const isExpired = invite.expiresAt < new Date()

                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isAccepted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : isExpired ? (
                        <Clock className="w-4 h-4 text-destructive flex-shrink-0" />
                      ) : (
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {invite.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isAccepted
                            ? 'Joined'
                            : isExpired
                              ? 'Invite expired'
                              : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {!isAccepted && !isExpired && (
                      <CopyInviteLink inviteUrl={inviteUrl} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Receipt */}
      {purchase && purchase.status === 'COMPLETED' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Payment Receipt</CardTitle>
            </div>
            {checkoutSession?.customer_details?.email && (
              <CardDescription>
                {checkoutSession.customer_details.email}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fee Breakdown */}
            <div className="space-y-2">
              {/* Registration Fee (base) - calculate from total minus fees */}
              <div className="flex justify-between text-sm">
                <span>Registration Fee</span>
                <span>
                  {formatCurrency(
                    purchase.totalCents -
                      purchase.platformFeeCents -
                      (passStripeFeesToCustomer ? purchase.stripeFeeCents : 0),
                  )}
                </span>
              </div>

              {/* Platform Fee */}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Platform Fee</span>
                <span>{formatCurrency(purchase.platformFeeCents)}</span>
              </div>

              {/* Stripe Fee (only if passed to customer) */}
              {passStripeFeesToCustomer && purchase.stripeFeeCents > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Payment Processing Fee</span>
                  <span>{formatCurrency(purchase.stripeFeeCents)}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Total */}
            <div className="flex justify-between font-medium">
              <span>Total Paid</span>
              <span>{formatCurrency(purchase.totalCents)}</span>
            </div>

            {/* Payment Method & Date */}
            <div className="text-xs text-muted-foreground text-center pt-2 space-y-1">
              {typeof checkoutSession?.payment_intent === 'object' &&
                checkoutSession.payment_intent?.payment_method_types && (
                  <p>
                    Paid via{' '}
                    {checkoutSession.payment_intent.payment_method_types[0]}
                  </p>
                )}
              {purchase.completedAt && (
                <p>
                  {new Date(purchase.completedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!isProfileComplete && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-lg">Complete Your Profile</CardTitle>
            </div>
            <CardDescription>
              Please provide your gender and date of birth for competition
              purposes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileCompletionForm
              currentGender={user?.gender}
              currentDateOfBirth={user?.dateOfBirth}
              currentAffiliateName={user?.affiliateName}
              onSubmit={handleProfileUpdate}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
