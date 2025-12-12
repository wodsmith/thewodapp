import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Link } from '@tanstack/react-router'
import { getMovementsFn } from '~/server-functions/movements'
import MovementList from '~/components/movements/movement-list'

export const Route = createFileRoute('/_main/movements/')({
  loader: async () => {
    return getMovementsFn()
  },
  component: MovementsIndexComponent,
})

function MovementsIndexComponent() {
  const movements = Route.useLoaderData()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-bold text-2xl">MOVEMENTS</h1>
        <Button asChild>
          <Link to="/movements/new" className="btn flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <span>Create Movement</span>
          </Link>
        </Button>
      </div>

      <MovementList movements={movements} />
    </div>
  )
}
