import { createFileRoute } from '@tanstack/react-router'
import { getMovementDetailFn } from '~/server-functions/movements'
import MovementDetailClient from '~/components/movements/movement-detail-client'

export const Route = createFileRoute('/_main/movements/$id')({
  loader: async ({ params }) => {
    return getMovementDetailFn({ id: params.id })
  },
  component: MovementDetailComponent,
})

function MovementDetailComponent() {
  const { movement, workouts, workoutResults } = Route.useLoaderData()

  return (
    <MovementDetailClient
      movement={movement}
      workouts={workouts}
      workoutResults={workoutResults}
    />
  )
}
