import { useEffect, useState } from "react"
import { CreateEventDialog } from "@/components/events/create-event-dialog"
import type { InferredCompetitionEventGroup } from "@/lib/workout-authoring"
import { createRoot } from "react-dom/client"
import { createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from "@tanstack/react-router"
import { AthleteTraining } from "@/components/training/athlete-training"
import { CoachPlanner } from "@/components/training/coach-planner"
import { context, getTrainingWorkoutOptionsFn } from "./fixtures"
import "./preview.css"

const rootRoute = createRootRoute({component: () => <><header className="border-b border-border px-5 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><a href="/training" className="text-xl"><strong>WOD</strong>smith</a><span className="text-xs text-muted-foreground">Component preview · illustrative data · saved in this browser</span><nav className="flex gap-5 text-sm"><a href="/training">Athlete</a><a href="/training/programming">Coach</a><a href="/compete-reference">Compete form</a><button type="button" onClick={() => document.documentElement.classList.toggle("dark")}>Change theme</button></nav></div></header><Outlet /></>})
const athlete = createRoute({getParentRoute: () => rootRoute, path: "/training", component: () => <AthleteTraining context={context} initialView={new URLSearchParams(location.search).get("view") === "team" ? "team" : "training"} />})
const coach = createRoute({getParentRoute: () => rootRoute, path: "/training/programming", component: () => <CoachPlanner context={context} />})
const compete = createRoute({
  getParentRoute: () => rootRoute,
  path: "/compete-reference",
  component: () => {
    const [open, setOpen] = useState(true)
    const [created, setCreated] = useState<InferredCompetitionEventGroup | null>(null)
    const [movements, setMovements] = useState<
      Awaited<ReturnType<typeof getTrainingWorkoutOptionsFn>>["movements"]
    >([])
    useEffect(() => {
      void getTrainingWorkoutOptionsFn().then((options) =>
        setMovements(options.movements),
      )
    }, [])
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Competition events</h1>
            <p className="text-sm text-muted-foreground">
              Jev authoring preview · illustrative persistence
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => setOpen(true)}
          >
            Create event
          </button>
        </div>
        {created && (
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Parent event
              </span>
              <h2 className="text-xl font-semibold">{created.name}</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Scheduled together · scored per sub-event
            </p>
            <div className="mt-5 space-y-3 border-l-2 border-primary/20 pl-5">
              {created.subEvents.map((event) => (
                <article key={event.name} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{event.name}</h3>
                    <span className="rounded-full border px-2 py-1 text-xs">
                      {event.scheme === "time-with-cap"
                        ? "For time · 10:00 cap"
                        : "Max load"}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm">
                    {event.description}
                  </p>
                  {!!event.scalingDescriptions?.length && (
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      {event.scalingDescriptions.map((scale) => (
                        <div key={scale.scalingLevelId} className="rounded bg-muted p-2">
                          <strong>{scale.scalingLevelId.replaceAll("-", " ")}</strong>
                          <div>{scale.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        <CreateEventDialog
          authoringContext={{ kind: "competition", competitionId: "preview" }}
          open={open}
          onOpenChange={setOpen}
          onCreateEvent={async () => setOpen(false)}
          onCreateEventGroup={async (group) => {
            setCreated(group)
            setOpen(false)
          }}
          movements={movements.map((movement) => ({
            ...movement,
            createdAt: new Date("2026-09-07T00:00:00Z"),
            updatedAt: new Date("2026-09-07T00:00:00Z"),
            updateCounter: 0,
          }))}
        />
      </main>
    )
  },
})
const router = createRouter({routeTree: rootRoute.addChildren([athlete, coach, compete])})
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />)
