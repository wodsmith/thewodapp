'use client'

import {Loader2, UserPlus} from 'lucide-react'
import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'

interface InviteSignUpFormProps {
  inviteToken: string
  inviteEmail: string
}

/**
 * Inline signup form for accepting an invite without an existing account.
 *
 * TODO: This is a simplified version that redirects to signup.
 * The full implementation would:
 * 1. Create user account inline
 * 2. Auto-accept the invite in one action
 * 3. Set up session and redirect
 *
 * For now, we redirect to the signup page with returnTo to bring them back.
 */
export function InviteSignUpForm({
  inviteToken,
  inviteEmail,
}: InviteSignUpFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [formData, setFormData] = useState({
    email: inviteEmail,
    firstName: '',
    lastName: '',
    password: '',
  })

  const emailChanged =
    formData.email.toLowerCase() !== inviteEmail.toLowerCase()
  const returnTo = `/compete/invite/${inviteToken}`

  // For the MVP, we'll redirect to signup with returnTo
  // TODO: Implement inline signup with invite auto-accept
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)

    // Build signup URL with prefilled data and returnTo
    const signupUrl = new URL('/sign-up', window.location.origin)
    signupUrl.searchParams.set('returnTo', returnTo)
    signupUrl.searchParams.set('email', formData.email)
    if (formData.firstName) {
      signupUrl.searchParams.set('firstName', formData.firstName)
    }
    if (formData.lastName) {
      signupUrl.searchParams.set('lastName', formData.lastName)
    }

    // Redirect to signup
    window.location.href = signupUrl.toString()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          disabled={isPending}
          required
        />
        {emailChanged && (
          <p className="text-xs text-muted-foreground">
            This will update your invite email from {inviteEmail}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) =>
              setFormData({...formData, firstName: e.target.value})
            }
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) =>
              setFormData({...formData, lastName: e.target.value})
            }
            disabled={isPending}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          disabled={isPending}
          required
          minLength={6}
        />
      </div>

      <div className="flex flex-col items-center gap-4 pt-2">
        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account & Join Team
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
