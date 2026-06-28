// @lat: [[crew#Regional Judge Discovery Pilot]]
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/discovery/judges")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/events/$eventId",
      params,
    })
  },
})
