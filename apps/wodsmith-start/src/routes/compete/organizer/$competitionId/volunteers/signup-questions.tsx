/**
 * Organizer Volunteer Signup Questions Page
 *
 * Manages the custom questions volunteers answer when signing up.
 */
// @lat: [[organizer-dashboard#Volunteers#Volunteer Signup Questions]]

import { createFileRoute, useRouter } from "@tanstack/react-router"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import { getVolunteerQuestionsFn } from "@/server-fns/registration-questions-fns"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/volunteers/signup-questions",
)({
  staleTime: 10_000,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition

    if (!competition) {
      throw new Error("Competition not found")
    }

    const { questions } = await getVolunteerQuestionsFn({
      data: { competitionId: competition.id },
    })

    return {
      competition,
      volunteerQuestions: questions,
    }
  },
  component: SignupQuestionsPage,
})

function SignupQuestionsPage() {
  const { competition, volunteerQuestions } = Route.useLoaderData()
  const router = useRouter()

  const handleQuestionsChange = () => {
    router.invalidate()
  }

  return (
    <RegistrationQuestionsEditor
      entityType="competition"
      entityId={competition.id}
      teamId={competition.organizingTeamId}
      questions={volunteerQuestions}
      onQuestionsChange={handleQuestionsChange}
      questionTarget="volunteer"
    />
  )
}
