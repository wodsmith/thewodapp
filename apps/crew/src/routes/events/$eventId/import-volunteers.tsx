// @lat: [[crew#Import CSV Preview]]
// @lat: [[crew#Import Apply]]
import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, FileCheck2, ShieldCheck, UsersRound } from "lucide-react"
import { VolunteerImportFlow } from "@/components/crew/volunteer-import-flow"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/events/$eventId/import-volunteers")({
  component: ImportVolunteersPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function ImportVolunteersPage() {
  const { eventId } = parentRoute.useParams()
  const router = useRouter()

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <div className="space-y-3 sm:space-y-5">
        <Button asChild variant="ghost" className="-ml-3 w-fit">
          <Link to="/events/$eventId/volunteers" params={{ eventId }}>
            <ArrowLeft />
            Back to roster
          </Link>
        </Button>

        <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between lg:pb-6">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              Import volunteers
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Upload a volunteer list, confirm how its columns map to Crew, and
              review every change before you import it into the roster.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm lg:grid lg:w-[34rem] lg:grid-cols-1">
            <ImportPromise icon={FileCheck2} text="CSV and Excel supported" />
            <ImportPromise
              icon={ShieldCheck}
              text="Preview does not change the roster"
            />
            <ImportPromise
              icon={UsersRound}
              text="Only ready rows are imported"
            />
          </div>
        </div>
      </div>

      <VolunteerImportFlow
        eventId={eventId}
        onApplyComplete={async () => {
          await router.invalidate()
        }}
      />
    </div>
  )
}

function ImportPromise({
  icon: Icon,
  text,
}: {
  icon: typeof FileCheck2
  text: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}
