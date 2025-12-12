import { createFileRoute } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { Link } from '@tanstack/react-router'
import { getLogsFn } from '~/server-functions/logs'
import LogCalendarClient from '~/components/logs/log-calendar-client'
import { LogRowCard } from '~/components/logs/log-row-card'

export const Route = createFileRoute('/_main/log/')({
  loader: async () => {
    return getLogsFn()
  },
  component: LogIndexComponent,
})

function LogIndexComponent() {
  const logs = Route.useLoaderData()

  return (
    <div className="px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="dark:text-white">WORKOUT LOG</h1>
        <Button asChild>
          <Link to="/log/new">Log New Result</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="mb-8 flex-1">
          <h2 className="mb-4 font-semibold capitalize text-xl dark:text-white">
            Recent Results
          </h2>
          {logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log) => (
                <LogRowCard key={log.id} logEntry={log} />
              ))}
            </div>
          ) : (
            <p className="dark:text-white">No recent results.</p>
          )}
        </div>
        <LogCalendarClient logs={logs} />
      </div>
    </div>
  )
}
