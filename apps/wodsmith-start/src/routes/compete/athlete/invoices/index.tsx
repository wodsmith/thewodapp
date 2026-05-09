import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/athlete/invoices/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/billing" })
  },
})
