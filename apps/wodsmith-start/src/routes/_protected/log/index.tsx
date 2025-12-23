import {createFileRoute} from '@tanstack/react-router'
import {getLogsByUserFn} from '@/server-fns/log-fns'
import {Button} from '@/components/ui/button'
import {LogRowCard} from '@/components/log-row-card'
import {LogCalendar} from '@/components/log-calendar'

export const Route = createFileRoute('/_protected/log/')({
  component: LogPage,
  loader: async ({context}) => {
    const session = context.session

    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    const result = await getLogsByUserFn({
      data: {userId: session.userId},
    })

    return {
      logs: result.logs,
    }
  },
})

function LogPage() {
  const {logs} = Route.useLoaderData()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-bold">WORKOUT LOG</h1>
        <Button asChild>
          <a href="/log/new">Log New Result</a>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Recent Results</h2>
          {logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log) => (
                <LogRowCard key={log.id} logEntry={log} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent results.</p>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold">Calendar View</h2>
          <LogCalendar logs={logs} />
        </div>
      </div>
    </div>
  )
}
