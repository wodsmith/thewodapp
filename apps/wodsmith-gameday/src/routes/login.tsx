import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useAuthStore } from "@/state/auth"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || ""
      const res = await fetch(`${apiBase}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? `Login failed (${res.status})`)
      }

      const data = (await res.json()) as {
        token: string
        expiresAt: string
        userId: string
      }
      setAuth(data.token, data.userId)
      navigate({ to: "/competitions" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px" }}>
      <h1>WODsmith Gameday</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: 8 }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  )
}
