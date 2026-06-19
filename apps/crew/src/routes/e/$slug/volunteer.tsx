import { createFileRoute, notFound } from "@tanstack/react-router"
import { CrewVolunteerSignupForm } from "@/components/crew/volunteer-signup-form"
import { getCrewVolunteerSignupPageFn } from "@/server-fns/crew-volunteer-fns"

export const Route = createFileRoute("/e/$slug/volunteer")({
  loader: async ({ params }) => {
    const result = await getCrewVolunteerSignupPageFn({
      data: { slug: params.slug },
    })

    if (!result.event) {
      throw notFound()
    }

    return result
  },
  component: CrewVolunteerSignupPage,
  head: ({ loaderData }) => {
    const event = loaderData?.event
    if (!event) {
      return { meta: [{ title: "Crew Event Not Found" }] }
    }

    return {
      meta: [
        { title: `Volunteer for ${event.name} | WODsmith Crew` },
        {
          name: "description",
          content: `Sign up to volunteer for ${event.name}.`,
        },
      ],
    }
  },
})

function CrewVolunteerSignupPage() {
  const { event, questions, waivers } = Route.useLoaderData()

  if (!event) {
    return null
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <CrewVolunteerSignupForm
        event={event}
        questions={questions}
        waivers={waivers}
      />
    </main>
  )
}
