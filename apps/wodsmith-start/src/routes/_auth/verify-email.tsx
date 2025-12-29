import {env} from 'cloudflare:workers'
import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {createServerFn} from '@tanstack/react-start'
import {eq} from 'drizzle-orm'
import {useEffect, useRef, useState} from 'react'
import {z} from 'zod'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Spinner} from '@/components/ui/spinner'
import {REDIRECT_AFTER_SIGN_IN} from '@/constants'
import {getDb} from '@/db'
import {userTable} from '@/db/schema'
import {getVerificationTokenKey} from '@/utils/auth-utils'
import {updateAllSessionsOfUser} from '@/utils/kv-session'

// Define schema inline to avoid import issues
const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

// Server function for email verification
const verifyEmailServerFn = createServerFn({method: 'POST'})
  .inputValidator(
    (data: unknown): z.infer<typeof verifyEmailSchema> =>
      verifyEmailSchema.parse(data),
  )
  .handler(async ({data}) => {
    const kv = env.KV_SESSION

    if (!kv) {
      throw new Error("Can't connect to KV store")
    }

    const verificationTokenStr = await kv.get(
      getVerificationTokenKey(data.token),
    )

    if (!verificationTokenStr) {
      throw new Error('Verification token not found or expired')
    }

    const verificationToken = JSON.parse(verificationTokenStr) as {
      userId: string
      expiresAt: string
    }

    // Check if token is expired (although KV should have auto-deleted it)
    if (new Date() > new Date(verificationToken.expiresAt)) {
      throw new Error('Verification token not found or expired')
    }

    const db = getDb()

    // Find user
    const user = await db.query.userTable.findFirst({
      where: eq(userTable.id, verificationToken.userId),
    })

    if (!user) {
      throw new Error('User not found')
    }

    try {
      // Update user's email verification status
      await db
        .update(userTable)
        .set({emailVerified: new Date()})
        .where(eq(userTable.id, verificationToken.userId))

      // Update all sessions of the user to reflect the new email verification status
      await updateAllSessionsOfUser(verificationToken.userId)

      // Delete the used token
      await kv.delete(getVerificationTokenKey(data.token))

      // Add a small delay to ensure all updates are processed
      await new Promise((resolve) => setTimeout(resolve, 500))

      return {success: true}
    } catch (error) {
      console.error(error)
      throw new Error('An unexpected error occurred')
    }
  })

export const Route = createFileRoute('/_auth/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || '',
    }
  },
})

function VerifyEmailPage() {
  const router = useRouter()
  const {token} = Route.useSearch()
  const hasCalledVerification = useRef(false)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Invalid verification link')
      return
    }

    if (hasCalledVerification.current) {
      return
    }

    const verifyEmail = async () => {
      try {
        // Validate token format
        const result = verifyEmailSchema.safeParse({token})
        if (!result.success) {
          setStatus('error')
          setErrorMessage('Invalid verification token')
          return
        }

        hasCalledVerification.current = true
        await verifyEmailServerFn({data: {token}})

        setStatus('success')

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.navigate({to: REDIRECT_AFTER_SIGN_IN})
        }, 2000)
      } catch (err) {
        setStatus('error')
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to verify email',
        )
      }
    }

    verifyEmail()
  }, [token, router])

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex flex-col items-center space-y-4">
              <Spinner size="large" />
              <CardTitle>Verifying Email</CardTitle>
              <CardDescription>
                Please wait while we verify your email address...
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Email Verified!</CardTitle>
            <CardDescription>
              Your email has been verified successfully. Redirecting to
              dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={REDIRECT_AFTER_SIGN_IN} className="w-full block">
              <Button variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  return (
    <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verification Failed</CardTitle>
          <CardDescription>
            {errorMessage || 'Failed to verify email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/sign-in"
            search={{redirect: REDIRECT_AFTER_SIGN_IN}}
            className="w-full block"
          >
            <Button variant="outline" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
