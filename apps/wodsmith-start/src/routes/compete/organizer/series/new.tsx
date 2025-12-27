import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {ArrowLeft} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {OrganizerSeriesForm} from '@/components/organizer-series-form'

export const Route = createFileRoute('/compete/organizer/series/new')({
  component: NewSeriesPage,
  loader: async ({context}) => {
    const session = context.session
    const userTeams = session?.teams || []
    const selectedTeamId = userTeams[0]?.id

    return {
      selectedTeamId,
    }
  },
})

function NewSeriesPage() {
  const {selectedTeamId} = Route.useLoaderData()
  const navigate = useNavigate()

  if (!selectedTeamId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Team Found</h1>
          <p className="text-muted-foreground mb-6">
            You need to be part of a team to create series.
          </p>
        </div>
      </div>
    )
  }

  const handleSuccess = () => {
    // Navigate to series list after successful creation
    navigate({to: '/compete/organizer/series'})
  }

  const handleCancel = () => {
    navigate({to: '/compete/organizer/series'})
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Series
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Create Series</h1>
          <p className="text-muted-foreground mt-1">
            Group related competitions into a series
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Series Details</CardTitle>
            <CardDescription>
              Enter the basic information for your competition series
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizerSeriesForm
              organizingTeamId={selectedTeamId}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
