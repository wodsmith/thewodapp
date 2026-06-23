// @lat: [[crew#Pilot Readiness Checklist]]
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/readiness")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/events/$eventId/setup",
      params,
    })
  },
})
