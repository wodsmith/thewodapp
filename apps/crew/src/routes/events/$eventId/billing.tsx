// @lat: [[crew#Billing Page And Upgrade CTA]]
// @lat: [[crew#Crew Checkout Sessions]]
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/billing")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/events/$eventId",
      params,
    })
  },
})
