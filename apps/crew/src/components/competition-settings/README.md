# Registration Questions Editor

Component for managing custom registration questions in competitions.

## Location
`src/components/competition-settings/registration-questions-editor.tsx`

## Usage Example

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { useNavigate } from "@tanstack/react-router"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionQuestionsFn } from "@/server-fns/registration-questions-fns"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"

export const Route = createFileRoute("/compete/organizer/$competitionId/registration-questions")({
  loader: async ({ params }) => {
    const [competitionResult, questionsResult] = await Promise.all([
      getCompetitionByIdFn({ data: { competitionId: params.competitionId } }),
      getCompetitionQuestionsFn({ data: { competitionId: params.competitionId } })
    ])

    if (!competitionResult.competition) {
      throw new Error("Competition not found")
    }

    return {
      competition: competitionResult.competition,
      questions: questionsResult.questions
    }
  },
  component: RegistrationQuestionsPage,
})

function RegistrationQuestionsPage() {
  const { competition, questions } = Route.useLoaderData()
  const navigate = useNavigate()

  const handleQuestionsChange = () => {
    // Trigger a router reload to refresh questions
    navigate({ to: ".", replace: true })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registration Questions</h1>
        <p className="text-muted-foreground mt-1">
          Manage custom questions for athlete registration
        </p>
      </div>

      <RegistrationQuestionsEditor
        competitionId={competition.id}
        teamId={competition.organizingTeamId}
        questions={questions}
        onQuestionsChange={handleQuestionsChange}
      />
    </div>
  )
}
```

## Features

- **Drag-and-drop reordering** - Questions can be reordered using the grip handle
- **Question types** - Support for text, select (dropdown), and number questions
- **Required/optional** - Mark questions as required or optional
- **Team questions** - Questions can be asked for each teammate individually
- **Help text** - Optional guidance text shown below the question
- **Select options** - For dropdown questions, manage multiple choice options

## Props

```typescript
interface RegistrationQuestionsEditorProps {
  competitionId: string
  teamId: string
  questions: RegistrationQuestion[]
  onQuestionsChange: () => void // Called when questions are added, updated, deleted, or reordered
}
```

## Question Types

- `text` - Free-form text input
- `select` - Dropdown with predefined options
- `number` - Numeric input

## Permissions

Requires `MANAGE_PROGRAMMING` permission on the team.
