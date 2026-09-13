import { createFileRoute } from "@tanstack/react-router"
import { handleGameDayDeviceRequest } from "@/server/gameday-push"

export const Route = createFileRoute("/api/gameday/v1/devices")({
  server: {
    handlers: {
      PUT: ({ request }) => handleGameDayDeviceRequest(request),
      DELETE: ({ request }) => handleGameDayDeviceRequest(request),
    },
  },
})
