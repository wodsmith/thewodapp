"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRight, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SessionValidationResult } from "@/types"

interface FinalCTAProps {
  session: SessionValidationResult
}

export function FinalCTA({ session }: FinalCTAProps) {
  const isLoggedIn = !!session?.user

  return (
    <section className="border-t border-border bg-foreground py-20 text-background dark:bg-card dark:text-foreground">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
            <Trophy className="h-8 w-8 text-amber-500" />
          </div>

          {/* Headline */}
          <h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to see your competition take shape?
          </h2>

          {/* Promise */}
          <p className="mb-8 text-lg text-background/70 dark:text-muted-foreground">
            Create a free draft, review the readiness checklist, and share a
            public preview before you open paid registration.
          </p>

          {/* CTAs */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="bg-background text-foreground hover:bg-background/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
              asChild
            >
              <Link
                to={
                  isLoggedIn
                    ? "/compete/organizer"
                    : "/compete/organizer/onboard"
                }
              >
                Create a Free Draft Competition
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-background/20 text-background hover:bg-background/10 dark:border-border dark:text-foreground dark:hover:bg-secondary"
              asChild
            >
              <Link to="/compete">Browse Competitions</Link>
            </Button>
          </div>

          {/* Friction clarifier */}
          <p className="mt-6 text-sm text-background/50 dark:text-muted-foreground">
            No credit card required. Approval only gates paid registration when
            needed.
          </p>
        </div>
      </div>
    </section>
  )
}
