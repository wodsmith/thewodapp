'use client'

import {LogOut} from 'lucide-react'
import {createServerFn} from '@tanstack/react-start'
import {Button} from '@/components/ui/button'

// Server function to handle logout
const logoutServerFn = createServerFn({method: 'POST'}).handler(async () => {
  const {deleteSessionTokenCookie, deleteActiveTeamCookie} =
    await import('@/utils/auth')
  const {getCookie} = await import('@tanstack/react-start/server')
  const {SESSION_COOKIE_NAME} = await import('@/constants')

  const sessionCookie = getCookie(SESSION_COOKIE_NAME)

  if (sessionCookie) {
    // Decode session to get sessionId and userId
    const parts = sessionCookie.split(':')
    if (parts.length === 2 && parts[0] && parts[1]) {
      const userId = parts[0]
      const token = parts[1]

      // Generate session ID from token and invalidate it
      const {invalidateSession} = await import('@/utils/auth')
      const {encodeHexLowerCase} = await import('@oslojs/encoding')

      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(token),
      )
      const sessionId = encodeHexLowerCase(new Uint8Array(hashBuffer))

      await invalidateSession(sessionId, userId)
    }
  }

  // Delete cookies
  await deleteSessionTokenCookie()
  await deleteActiveTeamCookie()

  return {success: true}
})

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      await logoutServerFn()

      // Navigate to sign-in page after logout using window.location
      // This ensures a full page reload and clears any client state
      window.location.href = '/sign-in'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLogout}
      aria-label="Log out"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  )
}
