import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
})
