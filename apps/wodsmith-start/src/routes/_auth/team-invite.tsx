/**
 * Team Invite Route
 * Handles accepting team invitations via token in URL
 */

import {createFileRoute, redirect, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {Loader2} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import {toast} from 'sonner'
import {z} from 'zod'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {acceptTeamInvitationFn, getSessionInfoFn} from '@/server-fns/invite-fns'

// Search params schema
const teamInviteSearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/_auth/team-invite')({
  component: TeamInvitePage,
  validateSearch: (search) => teamInviteSearchSchema.parse(search),
  beforeLoad: async ({search}) => {
    const token = search.token

    // If no token is provided, redirect to sign in
    if (!token) {
      throw redirect({to: '/sign-in', search: {redirect: '/'}})
    }

    // Check if user is logged in
    const session = await getSessionInfoFn()

    // If user is not logged in, redirect to sign in with return URL
    if (!session) {
      const returnUrl = `/team-invite?token=${token}`
      throw redirect({
        to: '/sign-in',
        search: {redirect: returnUrl},
      })
    }
  },
})

function TeamInvitePage() {
  const router = useRouter()
  const {token} = Route.useSearch()
  const hasCalledAcceptInvite = useRef(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<{message: string; code?: string} | null>(
    null,
  )

  const acceptInvitation = useServerFn(acceptTeamInvitationFn)

  useEffect(() => {
    if (!token || hasCalledAcceptInvite.current) {
      return
    }

    const handleAcceptInvite = async () => {
      hasCalledAcceptInvite.current = true
      setIsPending(true)
      toast.loading('Processing your invitation...')

      try {
        const result = await acceptInvitation({data: {token}})

        toast.dismiss()
        toast.success("You've successfully joined the team!")

        // Redirect to the team settings page
        setTimeout(() => {
          if (result.teamSlug) {
            router.navigate({to: `/settings/teams/${result.teamSlug}`})
          } else {
            // Fallback to settings if teamSlug is not found
            router.navigate({to: '/settings'})
          }
        }, 500)
      } catch (err) {
        toast.dismiss()
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to accept team invitation'

        // Parse error code from message if present
        let errorCode: string | undefined
        if (errorMessage.startsWith('CONFLICT:')) {
          errorCode = 'CONFLICT'
        } else if (errorMessage.startsWith('FORBIDDEN:')) {
          errorCode = 'FORBIDDEN'
        } else if (errorMessage.startsWith('NOT_FOUND:')) {
          errorCode = 'NOT_FOUND'
        } else if (errorMessage.startsWith('NOT_AUTHORIZED:')) {
          errorCode = 'NOT_AUTHORIZED'
        }

        setError({message: errorMessage, code: errorCode})
        toast.error(errorMessage)
      } finally {
        setIsPending(false)
      }
    }

    handleAcceptInvite()
  }, [token, acceptInvitation, router])

  if (isPending) {
    return (
      <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <CardTitle>Accepting Invitation</CardTitle>
              <CardDescription>
                Please wait while we process your team invitation...
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>
              {error.message.replace(
                /^(CONFLICT|FORBIDDEN|NOT_FOUND|NOT_AUTHORIZED|ERROR):?\s*/i,
                '',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {error.code === 'CONFLICT'
                ? 'You are already a member of this team.'
                : error.code === 'FORBIDDEN' && error.message.includes('limit')
                  ? "You've reached the maximum number of teams you can join."
                  : 'The invitation may have expired or been revoked.'}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.navigate({to: '/settings/teams'})}
            >
              Go to Teams
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation Link</CardTitle>
            <CardDescription>
              The invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.navigate({to: '/settings/teams'})}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
