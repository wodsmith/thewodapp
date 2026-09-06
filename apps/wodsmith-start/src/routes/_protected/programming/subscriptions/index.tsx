import { createFileRoute } from "@tanstack/react-router"
import { getMyTrackLibrariesFn } from "@/server-fns/track-follow-fns"
export const Route = createFileRoute("/_protected/programming/subscriptions/")({
  loader: () => getMyTrackLibrariesFn(),
  component: SubscriptionsPage,
})
function SubscriptionsPage() {
  const { personal, gyms } = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <a
        href="/programming"
        className="inline-flex min-h-11 items-center underline"
      >
        Browse tracks
      </a>
      <h1 className="text-3xl font-semibold">My followed tracks</h1>
      <p className="text-muted-foreground">
        Following makes a track available in My training. Choose your default
        separately in Training.
      </p>
      {!personal ? (
        <p>
          Your personal workspace is unavailable.{" "}
          <a href="/settings" className="underline">
            Open account settings
          </a>
          .
        </p>
      ) : personal.tracks.length ? (
        <ul className="divide-y">
          {personal.tracks.map((track) => (
            <li key={track.id} className="py-4">
              <a
                href={`/programming/${track.id}`}
                className="inline-flex min-h-11 items-center text-lg font-medium underline"
              >
                {track.name}
              </a>
              <p>{track.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No followed tracks yet. Browse tracks to choose one.</p>
      )}
      <section className="border-t pt-6 space-y-4">
        <h2 className="text-2xl font-semibold">Gym libraries</h2>
        <p className="text-muted-foreground">
          Tracks available to gyms where you can manage programming.
        </p>
        {gyms.map((gym) => (
          <details key={gym.id}>
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">
              {gym.name}
            </summary>
            <ul className="divide-y">
              {gym.tracks.map((track) => (
                <li key={track.id}>
                  <a
                    className="inline-flex min-h-11 items-center underline"
                    href={`/programming/${track.id}`}
                  >
                    {track.name}
                  </a>
                </li>
              ))}
            </ul>
            {!gym.tracks.length && <p>No tracks added yet.</p>}
          </details>
        ))}
      </section>
    </main>
  )
}
