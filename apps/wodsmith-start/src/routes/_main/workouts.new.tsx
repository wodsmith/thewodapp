import { createFileRoute } from '@tanstack/react-router'
import { getCreateWorkoutDataFn } from '~/server-functions/workouts'
import CreateWorkoutClient from '~/components/workouts/create-workout-client'

export const Route = createFileRoute('/_main/workouts/new')({
  loader: async () => {
    return getCreateWorkoutDataFn()
  },
  component: WorkoutsNewComponent,
})

function WorkoutsNewComponent() {
  const {
    movements,
    tags,
    teamId,
    ownedTracks,
    teamsWithProgrammingPermission,
    scalingGroups,
  } = Route.useLoaderData()

  return (
    <CreateWorkoutClient
      movements={movements}
      tags={tags}
      teamId={teamId}
      ownedTracks={ownedTracks}
      teamsWithProgrammingPermission={teamsWithProgrammingPermission}
      scalingGroups={scalingGroups}
    />
  )
}
