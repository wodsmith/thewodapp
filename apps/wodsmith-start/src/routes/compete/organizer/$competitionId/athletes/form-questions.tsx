/**
 * Organizer Registration Form Questions Page
 *
 * Manages the custom questions athletes answer during signup. Series-inherited
 * questions render read-only; competition-specific questions are editable.
 */
// @lat: [[organizer-dashboard#Registrations (Athletes)]]

import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Link2 } from "lucide-react"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCompetitionQuestionsFn } from "@/server-fns/registration-questions-fns"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/athletes/form-questions",
)({
  staleTime: 10_000,
  component: FormQuestionsPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const { questions } = await getCompetitionQuestionsFn({
      data: { competitionId: params.competitionId },
    })

    return {
      competition,
      questions,
      teamId: competition.organizingTeamId,
    }
  },
})

function FormQuestionsPage() {
  const { competition, questions, teamId } = Route.useLoaderData()
  const router = useRouter()

  const handleQuestionsChange = () => {
    router.invalidate()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Inherited Series Questions (read-only) */}
      {questions.some((q) => q.source === "series") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Series registration questions
            </CardTitle>
            <CardDescription>
              These questions are inherited from the series and apply to all
              competitions.{" "}
              {competition.groupId && (
                <Link
                  to="/compete/organizer/series/$groupId"
                  params={{ groupId: competition.groupId }}
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Manage on series page
                </Link>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {questions
                .filter((q) => q.source === "series")
                .map((question) => (
                  <div
                    key={question.id}
                    className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium">{question.label}</h4>
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 shrink-0"
                        >
                          <Link2 className="h-3 w-3" />
                          From Series
                        </Badge>
                      </div>
                      {question.helpText && (
                        <p className="text-sm text-muted-foreground">
                          {question.helpText}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{question.type}</Badge>
                        <Badge
                          variant={question.required ? "destructive" : "outline"}
                        >
                          {question.required ? "Required" : "Optional"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competition-specific Registration Questions Editor */}
      <RegistrationQuestionsEditor
        entityType="competition"
        entityId={competition.id}
        teamId={teamId}
        questions={questions.filter((q) => q.source === "competition")}
        onQuestionsChange={handleQuestionsChange}
      />
    </div>
  )
}
