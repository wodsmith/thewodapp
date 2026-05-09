import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/athlete/sponsors/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/sponsors" })
  },
})
