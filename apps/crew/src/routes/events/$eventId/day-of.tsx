// @lat: [[crew#Scheduling Launch Scope]]
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/day-of")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/events/$eventId/shifts", params })
  },
})
