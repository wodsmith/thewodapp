import {Clock} from 'lucide-react'
import {cn} from '@/utils/cn'

interface PendingOrganizerBannerProps {
  variant: 'page-container' | 'sidebar-inset'
}

export function PendingOrganizerBanner({variant}: PendingOrganizerBannerProps) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <div
        className={cn(
          'flex items-center gap-3 py-3',
          variant === 'page-container' && 'container mx-auto px-4',
          variant === 'sidebar-inset' && 'px-6',
        )}
      >
        <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <a
            href="/compete/organizer/onboard/pending"
            className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
          >
            Application pending:
          </a>{' '}
          You can create draft competitions while your application is being
          reviewed. Drafts won't be visible until published after approval.
        </p>
      </div>
    </div>
  )
}
