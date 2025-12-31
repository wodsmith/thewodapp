'use client'

import {Link, useLocation} from '@tanstack/react-router'
import {Button} from '@/components/ui/button'
import {cn} from '@/utils/cn'

interface CompetitionTabsProps {
  slug: string
  isRegistered: boolean
  registrationOpen: boolean
  registrationClosed: boolean
  registrationNotYetOpen: boolean
}

const tabs = [
  {label: 'Event Details', href: ''},
  {label: 'Workouts', href: '/workouts'},
  {label: 'Schedule', href: '/schedule'},
  {label: 'Leaderboard', href: '/leaderboard'},
]

export function CompetitionTabs({
  slug,
  isRegistered,
  registrationOpen,
  registrationClosed,
  registrationNotYetOpen,
}: CompetitionTabsProps) {
  const location = useLocation()
  const pathname = location.pathname
  const basePath = `/compete/${slug}`

  // Determine register button state
  const getRegisterButtonText = () => {
    if (isRegistered) return 'Registered'
    if (registrationClosed) return 'Registration Closed'
    if (registrationNotYetOpen) return 'Registration Opens Soon'
    if (registrationOpen) return 'Register'
    return 'Registration Unavailable'
  }

  const isRegisterButtonDisabled =
    isRegistered ||
    registrationClosed ||
    registrationNotYetOpen ||
    !registrationOpen

  return (
    <div className="sticky top-0 z-10 border-b bg-background">
      <div className="container mx-auto">
        <div className="flex items-center justify-between gap-2">
          <nav className="flex h-auto gap-0 overflow-x-auto">
            {tabs.map((tab) => {
              const tabPath = `${basePath}${tab.href}`
              // For the root tab (Event Details), check exact match
              // For other tabs, check if pathname starts with the tab path
              const isActive =
                tab.href === ''
                  ? pathname === basePath
                  : pathname.startsWith(tabPath)

              return (
                <Link
                  key={tab.href}
                  to={tabPath}
                  className={cn(
                    'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-teal-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
          <div className="py-2 pr-4">
            {registrationOpen && !isRegistered ? (
              <Button
                variant="default"
                size="sm"
                className="bg-teal-600 hover:bg-teal-500"
                asChild
              >
                <Link to="/compete/$slug/register" params={{slug}}>
                  Register
                </Link>
              </Button>
            ) : (
              <Button
                variant={isRegistered ? 'outline' : 'default'}
                size="sm"
                disabled={isRegisterButtonDisabled}
                className={cn(isRegistered && 'cursor-default')}
              >
                {getRegisterButtonText()}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
