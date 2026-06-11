/**
 * Competition Leaderboard Preview Page
 *
 * Shared page body for the organizer and cohost leaderboard-preview routes.
 * Bypasses the division-results publishing filter so admins can review
 * aggregated standings as scores come in — before hitting publish. Reuses the
 * public `LeaderboardPageContent` component with `preview` enabled. The cohost
 * route flips the alert copy via `isCohost`.
 */
// @lat: [[organizer-dashboard#Cohost Dashboard#Shared Component Callback Pattern#Shared Page Components]]

import { Eye } from "lucide-react"
import type { ComponentProps } from "react"
import { z } from "zod"
import { LeaderboardPageContent } from "@/components/leaderboard-page-content"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type LeaderboardContentProps = ComponentProps<typeof LeaderboardPageContent>

// Match the public leaderboard search schema so existing filters work.
// Shared by both route shells' validateSearch.
export const leaderboardPreviewSearchSchema = z.object({
  division: z.string().optional(),
  event: z.string().optional(),
  affiliate: z.string().optional(),
})

interface LeaderboardPreviewPageProps {
  competition: { id: string } & LeaderboardContentProps["competition"]
  divisions: LeaderboardContentProps["divisions"]
  /** Cohost routes flip the alert copy; defaults to organizer wording. */
  isCohost?: boolean
}

export function LeaderboardPreviewPage({
  competition,
  divisions,
  isCohost = false,
}: LeaderboardPreviewPageProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <Eye className="h-4 w-4" />
        <AlertTitle>
          {isCohost ? "Co-host preview" : "Organizer preview"}
        </AlertTitle>
        <AlertDescription>
          This leaderboard includes all scored events and divisions, regardless
          of whether division results have been published. Use it to review the
          aggregated standings as scores come in. Athletes will not see
          unpublished results on the public leaderboard until{" "}
          {isCohost ? "the organizer publishes them" : "you publish them"}.
        </AlertDescription>
      </Alert>

      <LeaderboardPageContent
        competitionId={competition.id}
        divisions={divisions}
        competition={{
          slug: competition.slug,
          competitionType: competition.competitionType,
        }}
        preview
      />
    </div>
  )
}
