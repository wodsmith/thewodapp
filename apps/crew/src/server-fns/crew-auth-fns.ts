import { createServerFn } from "@tanstack/react-start"

export type { CrewAuthState } from "@/server/crew-auth.server"

export const getCrewAuthStateFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getCrewAuthState } = await import("@/server/crew-auth.server")
    return getCrewAuthState()
  },
)
