import { createFileRoute } from "@tanstack/react-router"
import { handleGameDayRequest } from "@/server/gameday"

export const Route = createFileRoute("/api/gameday/v1/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleGameDayRequest(request),
      PATCH: ({ request }) => handleGameDayRequest(request),
      DELETE: ({ request }) => handleGameDayRequest(request),
    },
  },
})
