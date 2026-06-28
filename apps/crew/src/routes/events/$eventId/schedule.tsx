import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/schedule")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/events/$eventId/shifts",
      params,
    })
  },
})
