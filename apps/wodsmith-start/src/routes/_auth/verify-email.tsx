import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {useEffect, useRef, useState} from 'react'
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
import {verifyEmailFn, verifyEmailSchema} from '@/server-fns/auth-fns'

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

  // Use useServerFn for client-side calls
  const verifyEmail = useServerFn(verifyEmailFn)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Invalid verification link')
      return
    }

    if (hasCalledVerification.current) {
      return
    }

    const doVerifyEmail = async () => {
      try {
        // Validate token format
        const result = verifyEmailSchema.safeParse({token})
        if (!result.success) {
          setStatus('error')
          setErrorMessage('Invalid verification token')
          return
        }

        hasCalledVerification.current = true
        await verifyEmail({data: {token}})

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

    doVerifyEmail()
  }, [token, router, verifyEmail])

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
