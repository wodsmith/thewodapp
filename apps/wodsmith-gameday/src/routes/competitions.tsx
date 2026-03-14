import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAuthStore } from "@/state/auth"
import { useEffect, useState } from "react"
import { getRegistrations } from "@/api/competitions"
import { Effect } from "effect"
import type { Registration } from "@/api/schemas"

export const Route = createFileRoute("/competitions")({
  component: CompetitionsPage,
})

function CompetitionsPage() {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const [registrations, setRegistrations] = useState<ReadonlyArray<Registration>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      navigate({ to: "/login" })
      return
    }

    let cancelled = false
    setLoading(true)
    Effect.runPromise(getRegistrations(token))
      .then((data) => {
        if (!cancelled) setRegistrations(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, navigate])

  if (loading) return <div style={{ padding: 16 }}>Loading competitions...</div>
  if (error) return <div style={{ padding: 16, color: "red" }}>{error}</div>

  return (
    <div style={{ padding: 16 }}>
      <h1>My Competitions</h1>
      {registrations.length === 0 ? (
        <p>No competition registrations found.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {registrations.map((reg) => (
            <li
              key={reg.id}
              style={{
                padding: 12,
                marginBottom: 8,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              <strong>{reg.eventId}</strong>
              <br />
              <span>Status: {reg.status}</span>
              {reg.teamName && <span> | Team: {reg.teamName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
