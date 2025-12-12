import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Metadata } from '@tanstack/react-start'
import CompeteNav from '~/components/nav/compete-nav'
import { SITE_URL } from '~/constants'

export const Route = createFileRoute('/_compete')({
  component: CompeteLayoutComponent,
  head: () => ({
    meta: [
      {
        title: 'WODsmith Compete',
        description: 'Find and register for CrossFit competitions.',
      },
    ],
  }),
})

function CompeteLayoutComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <CompeteNav />

      <main className="container mx-auto flex-1 pt-4 sm:p-4">
        <Outlet />
      </main>

      <footer className="border-black border-t-2 p-4">
        <div className="container mx-auto">
          <p className="text-center">
            &copy; {new Date().getFullYear()} WODsmith. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
