import { createFileRoute, Link } from "@tanstack/react-router"
import { CrewPublicScheduleView } from "@/components/crew/public-schedule-view"
import { getCrewPublicScheduleFn } from "@/server-fns/crew-published-schedule-fns"

export const Route = createFileRoute("/e/$slug/schedule/")({
  loader: ({ params }) =>
    getCrewPublicScheduleFn({ data: { slug: params.slug } }),
  staleTime: 0,
  gcTime: 0,
  head: () => ({
    meta: [
      { title: "Volunteer schedule | WODsmith Crew" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  headers: () => ({
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  }),
  component: PublicEventSchedulePage,
})

function PublicEventSchedulePage() {
  const { schedule } = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-5 py-8 sm:py-12 print:max-w-none print:p-0">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 font-semibold print:hidden"
      >
        <img src="/wodsmith-logo-no-text.png" alt="" width={28} height={28} />{" "}
        WODsmith Crew
      </Link>
      {schedule ? (
        <CrewPublicScheduleView schedule={schedule} />
      ) : (
        <section className="space-y-3 rounded-lg border p-6">
          <h1 className="text-2xl font-semibold">Schedule not available yet</h1>
          <p className="text-muted-foreground">
            Your organizer hasn’t published a schedule here, or has taken it
            offline to make changes. Check back or contact your competition
            organizer.
          </p>
        </section>
      )}
    </main>
  )
}
