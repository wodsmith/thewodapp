import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/athlete/edit/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/athlete" })
  },
})
