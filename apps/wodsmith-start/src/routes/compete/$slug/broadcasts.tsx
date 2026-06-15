import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/$slug/broadcasts")({
  loader: ({ params }) => {
    throw redirect({
      to: "/compete/$slug/announcements",
      params: { slug: params.slug },
    })
  },
})
