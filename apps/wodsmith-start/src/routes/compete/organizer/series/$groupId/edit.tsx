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
import {getCompetitionGroupByIdFn} from '@/server-fns/competition-fns'

export const Route = createFileRoute('/compete/organizer/series/$groupId/edit')(
  {
    component: EditSeriesPage,
    loader: async ({params, context}) => {
      const {groupId} = params
      const session = context.session
      const teamId = session?.teams?.[0]?.id

      if (!teamId) {
        return {
          group: null,
          teamId: null,
        }
      }

      // Fetch group details
      const groupResult = await getCompetitionGroupByIdFn({data: {groupId}})

      return {
        group: groupResult.group,
        teamId,
      }
    },
  },
)

function EditSeriesPage() {
  const {group, teamId} = Route.useLoaderData()
  const {groupId} = Route.useParams()
  const navigate = useNavigate()

  if (!teamId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Team Found</h1>
          <p className="text-muted-foreground mb-6">
            You need to be part of a team to edit series.
          </p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Series Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The series you're looking for doesn't exist or you don't have
            permission to edit it.
          </p>
          <Button variant="outline" asChild>
            <a href="/compete/organizer/series">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Series
            </a>
          </Button>
        </div>
      </div>
    )
  }

  const handleSuccess = () => {
    // Navigate back to series detail page after successful update
    navigate({to: '/compete/organizer/series/$groupId', params: {groupId}})
  }

  const handleCancel = () => {
    navigate({to: '/compete/organizer/series/$groupId', params: {groupId}})
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {group.name}
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Edit Series</h1>
          <p className="text-muted-foreground mt-1">
            Update the details for {group.name}
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Series Details</CardTitle>
            <CardDescription>
              Update the information for this competition series
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizerSeriesForm
              organizingTeamId={teamId}
              series={group}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
