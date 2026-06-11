import { createFileRoute, redirect } from "@tanstack/react-router"

type StatusFilter = "all" | "registration-open" | "active" | "upcoming" | "past"

type CompeteSearch = {
  q?: string
  filter?: StatusFilter
  location?: string
  organizer?: string
  type?: "in-person" | "online"
}

function isValidStatusFilter(value: unknown): value is StatusFilter {
  return (
    typeof value === "string" &&
    ["all", "registration-open", "active", "upcoming", "past"].includes(value)
  )
}

function preserveCompeteSearch(search: Record<string, unknown>): CompeteSearch {
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    filter: isValidStatusFilter(search.filter) ? search.filter : undefined,
    location: typeof search.location === "string" ? search.location : undefined,
    organizer:
      typeof search.organizer === "string" ? search.organizer : undefined,
    type:
      search.type === "in-person" || search.type === "online"
        ? search.type
        : undefined,
  }
}

export const Route = createFileRoute("/compete/")({
  // @lat: [[architecture#Route Groups#compete]]
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search: preserveCompeteSearch(search) })
  },
})
