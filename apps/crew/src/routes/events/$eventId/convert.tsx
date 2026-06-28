// @lat: [[crew#Full WODsmith Conversion Assistant]]
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/convert")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/events/$eventId",
      params,
    })
  },
})
