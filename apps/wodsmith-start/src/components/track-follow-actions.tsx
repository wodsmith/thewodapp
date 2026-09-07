import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  addTrackToGymFn,
  followTrackFn,
  type getTrackFollowStateFn,
} from "@/server-fns/track-follow-fns"

type State = Awaited<ReturnType<typeof getTrackFollowStateFn>>
export function TrackFollowActions({
  trackId,
  date,
  state,
  onChanged,
  gymOnly = false,
}: {
  trackId: string
  date?: string
  state: State
  onChanged: () => void
  gymOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [gymId, setGymId] = useState("")
  const [query, setQuery] = useState("")
  async function follow() {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await followTrackFn({ data: { trackId, following: !state.following } })
      setNotice(
        state.following ? "Track unfollowed" : "Following in My training",
      )
      onChanged()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not update following. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }
  async function addGym() {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await addTrackToGymFn({ data: { trackId, teamId: gymId } })
      setNotice(`Added to ${state.gyms.find((gym) => gym.id === gymId)?.name}`)
      onChanged()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not add to gym. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      {gymOnly ? (
        state.gyms.length > 0 && (
          <details>
            <summary className="cursor-pointer min-h-11 py-3 font-medium">
              For your gym
            </summary>
            <div className="space-y-3 pt-3">
              <label className="block space-y-2" htmlFor="gym-search">
                <span>Find a gym</span>
                <Input
                  id="gym-search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setGymId("")
                  }}
                />
              </label>
              <label className="block space-y-2" htmlFor="track-gym">
                <span>Gym library</span>
                <select
                  id="track-gym"
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                  value={gymId}
                  onChange={(e) => setGymId(e.target.value)}
                >
                  <option value="">Choose a gym</option>
                  {state.gyms
                    .filter((gym) =>
                      gym.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                        {gym.added ? " · Added" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                className="min-h-11"
                variant="outline"
                disabled={
                  busy ||
                  !gymId ||
                  state.gyms.some((gym) => gym.id === gymId && gym.added)
                }
                onClick={addGym}
              >
                Add to gym library
              </Button>
              {gymId &&
                state.gyms.some((gym) => gym.id === gymId && gym.added) && (
                  <a
                    className="block min-h-11 py-3 underline"
                    href={`/training?teamId=${encodeURIComponent(gymId)}&trackId=${encodeURIComponent(trackId)}${date ? `&date=${date}` : ""}`}
                  >
                    View gym Training
                  </a>
                )}
            </div>
          </details>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              className="min-h-11"
              variant={state.following ? "outline" : "default"}
              disabled={busy || state.following || !state.personalTeamId}
              onClick={state.following ? undefined : follow}
            >
              {state.following ? "Following" : "Follow track"}
            </Button>
            {state.following && (
              <details>
                <summary className="cursor-pointer min-h-11 py-3">
                  Following options
                </summary>
                <button
                  type="button"
                  disabled={busy}
                  onClick={follow}
                  className="min-h-11 underline"
                >
                  Unfollow track
                </button>
              </details>
            )}
            {state.following && state.trainingAvailable && (
              <a
                className="inline-flex min-h-11 items-center underline"
                href={`/training?teamId=${encodeURIComponent(state.personalTeamId ?? "")}&trackId=${encodeURIComponent(trackId)}${date ? `&date=${date}` : ""}`}
              >
                View in Training
              </a>
            )}
          </div>
          {!state.personalTeamId && (
            <p>
              Your personal workspace is unavailable.{" "}
              <a href="/settings" className="underline">
                Open account settings
              </a>{" "}
              to finish setup.
            </p>
          )}
          {state.following && !state.trainingAvailable && (
            <p>
              This track is followed. Training access is unavailable for your
              account.{" "}
              <a href="/settings" className="underline">
                View account settings
              </a>
              .
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <output>{notice}</output>}
    </div>
  )
}
