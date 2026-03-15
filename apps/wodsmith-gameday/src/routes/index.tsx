import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAuthStore } from "@/state/auth"
import { useEffect } from "react"

export const Route = createFileRoute("/")({
  component: IndexPage,
})

function IndexPage() {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate({ to: "/login" })
    } else {
      navigate({ to: "/competitions" })
    }
  }, [token, navigate])

  return <div>Loading...</div>
}
