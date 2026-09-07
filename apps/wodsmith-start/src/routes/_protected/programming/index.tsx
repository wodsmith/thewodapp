import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { getBrowseTracksFn } from "@/server-fns/track-follow-fns"
export const Route = createFileRoute("/_protected/programming/")({
  loader: () => getBrowseTracksFn(),
  component: PublicProgrammingPage,
})
function PublicProgrammingPage() {
  const tracks = Route.useLoaderData()
  const [query, setQuery] = useState("")
  const matches = tracks.filter((track) =>
    `${track.name} ${track.description ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Browse tracks</h1>
          <p className="mt-2 text-muted-foreground">
            Find programming to follow in My training or add to your gym
            library.
          </p>
        </div>
        <a
          href="/programming/subscriptions"
          className="inline-flex min-h-11 items-center underline"
        >
          My followed tracks
        </a>
      </header>
      <label className="block space-y-2" htmlFor="track-search">
        <span>Search tracks</span>
        <Input
          className="min-h-11 max-w-md"
          id="track-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Track name or description"
        />
      </label>
      <ul className="divide-y">
        {matches.map((track) => (
          <li key={track.id} className="py-6">
            <a
              href={`/programming/${track.id}`}
              className="inline-flex min-h-11 items-center break-words text-xl font-semibold underline"
            >
              {track.name}
            </a>
            {track.description && (
              <p className="mt-2 max-w-prose text-muted-foreground">
                {track.description}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!matches.length && (
        <p>
          {tracks.length
            ? "No tracks match this search."
            : "No public tracks are available yet."}
        </p>
      )}
    </main>
  )
}
