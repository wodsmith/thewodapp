// @lat: [[crew#Roster Shifts Assignments]]
// @lat: [[crew#Shift Board Pilot Ops]]
// @lat: [[crew#Judge Rotations]]
import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import { ClipboardList, UserCheck } from "lucide-react"
import {
  type CrewJudgeRotationsPageData,
  getCrewJudgeRotationsPageFn,
} from "@/server-fns/crew-judge-rotations-fns"
import { getCrewShiftBoardFn } from "@/server-fns/crew-roster-shift-fns"
import { CrewJudgeAssignmentsTab } from "./judges"
import { CrewShiftBoardAssignmentsTab } from "./shifts"

type CrewAssignmentsTab = "shifts" | "judges"

export const Route = createFileRoute("/events/$eventId/assignments")({
  loader: async ({ params }) => {
    const shiftBoard = await getCrewShiftBoardFn({
      data: { eventId: params.eventId },
    })
    const judgeAssignments = await getCrewJudgeAssignmentsRouteData(
      params.eventId,
    )

    return { shiftBoard, judgeAssignments }
  },
  component: EventAssignmentsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventAssignmentsPage() {
  const { eventId } = parentRoute.useParams()
  const { shiftBoard, judgeAssignments } = Route.useLoaderData()
  const search = useSearch({ strict: false }) as { tab?: unknown }
  const navigate = useNavigate()
  const selectedTab = normalizeCrewAssignmentsTab(search.tab)
  const judgeAvailability = getCrewJudgeAssignmentsAvailability(
    judgeAssignments?.page ?? null,
  )

  function selectTab(tab: CrewAssignmentsTab) {
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        tab,
      }),
      replace: true,
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold">Assignments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build the volunteer shift board and publish judge schedules from one
            organizer workspace.
          </p>
        </div>
        <Link
          to="/events/$eventId/volunteers"
          params={{ eventId }}
          className="inline-flex h-10 w-fit items-center rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Volunteer roster
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Assignment views"
        className="flex flex-wrap gap-2 border-b"
      >
        <AssignmentTabButton
          tab="shifts"
          label="Shifts"
          selected={selectedTab === "shifts"}
          onSelect={selectTab}
        />
        <AssignmentTabButton
          tab="judges"
          label="Judges"
          selected={selectedTab === "judges"}
          disabled={!judgeAvailability.available}
          disabledLabel={judgeAvailability.badgeLabel}
          onSelect={selectTab}
        />
      </div>

      {selectedTab === "judges" ? (
        judgeAvailability.available && judgeAssignments ? (
          <CrewJudgeAssignmentsTab data={judgeAssignments} />
        ) : (
          <JudgeAssignmentsUnavailable
            eventId={eventId}
            availability={judgeAvailability}
          />
        )
      ) : (
        <CrewShiftBoardAssignmentsTab data={shiftBoard} />
      )}
    </section>
  )
}

function AssignmentTabButton({
  tab,
  label,
  selected,
  disabled = false,
  disabledLabel,
  onSelect,
}: {
  tab: CrewAssignmentsTab
  label: string
  selected: boolean
  disabled?: boolean
  disabledLabel?: string
  onSelect: (tab: CrewAssignmentsTab) => void
}) {
  const Icon = tab === "shifts" ? ClipboardList : UserCheck

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled && !selected}
      onClick={() => onSelect(tab)}
      className={
        selected
          ? "inline-flex h-11 items-center gap-2 border-b-2 border-primary px-3 text-sm font-semibold text-foreground"
          : "inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {disabledLabel ? (
        <span className="rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {disabledLabel}
        </span>
      ) : null}
    </button>
  )
}

function JudgeAssignmentsUnavailable({
  eventId,
  availability,
}: {
  eventId: string
  availability: CrewJudgeAssignmentsAvailability
}) {
  return (
    <section className="rounded-md border bg-card p-8 shadow-sm">
      <div className="max-w-2xl">
        <h3 className="text-lg font-semibold">{availability.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {availability.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/events/$eventId/imports"
            params={{ eventId }}
            search={{ tab: "heat_schedule" }}
            className="inline-flex h-10 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Import heat schedule
          </Link>
          <Link
            to="/events/$eventId/setup"
            params={{ eventId }}
            className="inline-flex h-10 w-fit items-center rounded-md border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Review setup
          </Link>
        </div>
      </div>
    </section>
  )
}

export interface CrewJudgeAssignmentsAvailability {
  available: boolean
  title: string
  description: string
  badgeLabel?: string
}

export function getCrewJudgeAssignmentsAvailability(
  page: CrewJudgeRotationsPageData | null,
): CrewJudgeAssignmentsAvailability {
  if (!page) {
    return {
      available: false,
      title: "Judge assignments are not available yet",
      description:
        "Judge scheduling will appear here once the event is ready for judge assignments.",
      badgeLabel: "Unavailable",
    }
  }

  const hasWorkouts = page.workouts.length > 0
  const hasHeats = page.heats.length > 0
  if (hasWorkouts && hasHeats) {
    return {
      available: true,
      title: "Judge assignments are ready",
      description: "Workouts and heats are available for judge scheduling.",
    }
  }

  return {
    available: false,
    title: "Judge assignments are not ready yet",
    description:
      "Import or create the event workouts and heat schedule before assigning judges.",
    badgeLabel: "Needs heat schedule",
  }
}

function normalizeCrewAssignmentsTab(tab: unknown): CrewAssignmentsTab {
  return tab === "judges" ? "judges" : "shifts"
}

async function getCrewJudgeAssignmentsRouteData(eventId: string) {
  return await getCrewJudgeRotationsPageFn({ data: { eventId } })
}
