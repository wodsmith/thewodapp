"use client"

import { Link, useRouterState } from "@tanstack/react-router"
import { User } from "lucide-react"
import CompeteMobileNav from "@/components/compete-mobile-nav"
import { CompeteNavBrand } from "@/components/compete-nav-brand"
import { DarkModeToggle } from "@/components/nav/dark-mode-toggle"
import LogoutButton from "@/components/nav/logout-button"
import type { SessionValidationResult } from "@/types"

interface CompeteNavProps {
  session: SessionValidationResult
  canOrganize: boolean
  hasOrganizerApplication: boolean
}

export default function CompeteNav({
  session,
  canOrganize,
  hasOrganizerApplication,
}: CompeteNavProps) {
  // For now, we don't have these other features implemented in wodsmith-start
  const pendingInvitations: never[] = []
  const missingProfileFields = null
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isCompetitionIndex = pathname === "/"
  const isManageCompetitionsActive =
    pathname === "/compete/organizer" ||
    pathname.startsWith("/compete/organizer/")
  const competitionsLinkClass = isCompetitionIndex
    ? "font-bold text-foreground uppercase underline decoration-primary decoration-2 underline-offset-4 dark:text-dark-foreground"
    : "font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
  const manageCompetitionsLinkClass = isManageCompetitionsActive
    ? "flex items-center gap-1 font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4 dark:text-dark-foreground"
    : "flex items-center gap-1 font-bold text-foreground hover:underline dark:text-dark-foreground"
  const showManageCompetitionsLink = hasOrganizerApplication || canOrganize

  return (
    <header className="border-black border-b-2 bg-background dark:border-dark-border dark:bg-dark-background">
      <div className="container mx-auto flex items-center p-4">
        <CompeteNavBrand />
        <nav className="ml-auto hidden items-center gap-4 md:flex">
          {/* @lat: [[architecture#Route Groups#compete]] */}
          {session?.user ? (
            <>
              <Link
                to="/"
                aria-current={isCompetitionIndex ? "page" : undefined}
                className={competitionsLinkClass}
              >
                Competitions
              </Link>
              {showManageCompetitionsLink && (
                <>
                  <div className="h-6 border-black border-l-2 dark:border-dark-border" />
                  <Link
                    to="/compete/organizer"
                    aria-current={
                      isManageCompetitionsActive ? "page" : undefined
                    }
                    className={manageCompetitionsLinkClass}
                  >
                    MANAGE COMPETITIONS
                  </Link>
                </>
              )}
              {!hasOrganizerApplication && (
                <Link
                  to="/compete/organizer/onboard"
                  className="font-bold text-foreground hover:underline dark:text-dark-foreground"
                >
                  HOST A COMP
                </Link>
              )}
              <div className="mx-2 h-6 border-black border-l-2 dark:border-dark-border" />
              <a
                href="/settings/overview"
                className="font-bold text-foreground dark:text-dark-foreground"
              >
                <User className="h-5 w-5" />
              </a>
              <DarkModeToggle />
              <LogoutButton />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/"
                aria-current={isCompetitionIndex ? "page" : undefined}
                className={competitionsLinkClass}
              >
                Competitions
              </Link>
              <Link
                to="/sign-in"
                search={{ redirect: "/" }}
                className="btn-outline"
              >
                Login
              </Link>
              <Link to="/sign-up" search={{ redirect: "/" }} className="btn">
                Sign Up
              </Link>
              <DarkModeToggle />
            </div>
          )}
        </nav>
        <div className="ml-auto md:hidden">
          <CompeteMobileNav
            session={session}
            invitations={pendingInvitations}
            canOrganize={canOrganize}
            hasOrganizerApplication={hasOrganizerApplication}
            missingProfileFields={missingProfileFields}
          />
        </div>
      </div>
    </header>
  )
}
