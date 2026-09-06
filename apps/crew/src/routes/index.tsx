// @lat: [[crew#Scheduling Launch Scope]]
import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: HomePage })

function HomePage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <section className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Volunteer scheduling
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            Give every volunteer a place and a time.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Bring your volunteer list, create shifts, and assign your judges.
            Keep the registration platform you already use and leave with a
            schedule ready to share.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/events/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create your schedule
          </Link>
          <Link
            to="/events"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Open an event
          </Link>
        </div>
        <Link
          to="/calculator"
          className="inline-block text-sm text-muted-foreground underline underline-offset-4"
        >
          Estimate how many volunteers you need
        </Link>
      </section>
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">
          From volunteer list to ready schedule
        </h2>
        <ol className="mt-6 space-y-6">
          {[
            [
              "Bring your volunteers",
              "Import the volunteer list from your registration platform or add people yourself.",
            ],
            [
              "Build the schedule",
              "Create role-based shifts and assign volunteers. Add heats when you need lane-by-lane judge assignments.",
            ],
            [
              "Share with your crew",
              "Export and print your staffing schedule for volunteers and team leads.",
            ],
          ].map(([title, description], index) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
