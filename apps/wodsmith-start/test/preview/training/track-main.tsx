import { createRoot } from "react-dom/client"
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router"
import { useState } from "react"
import { TrackDetailView } from "@/components/track-detail-view"
import { CrossFitImportAdmin } from "@/components/crossfit-import-admin"
import { AthleteTraining } from "@/components/training/athlete-training"
import { trackData, previewContext } from "./track-fixtures"
import "./preview.css"
function Reader() {
  const query = new URLSearchParams(location.search)
  const [date, setDate] = useState(query.get("date") ?? "2026-09-06")
  const [, reload] = useState(0)
  return (
    <TrackDetailView
      data={trackData(date, query.get("admin") === "1")}
      onChanged={() => reload((value) => value + 1)}
      onDateChange={setDate}
    />
  )
}
const root = createRootRoute({
  component: () => (
    <>
      <header className="border-b px-4 py-3 text-sm">
        <p>Component preview · illustrative data · no production writes</p>
        <nav className="flex flex-wrap gap-4">
          <a
            className="min-h-11 py-3 underline"
            href="/programming/ptrk_crossfit_dotcom?admin=1"
          >
            Track and Admin
          </a>
          <a
            className="min-h-11 py-3 underline"
            href="/admin/programming/ptrk_crossfit_dotcom"
          >
            Imports
          </a>
          <a
            className="min-h-11 py-3 underline"
            href="/training?date=2026-09-04"
          >
            My training
          </a>
        </nav>
      </header>
      <Outlet />
    </>
  ),
})
const reader = createRoute({
  getParentRoute: () => root,
  path: "/programming/$trackId",
  component: Reader,
})
const admin = createRoute({
  getParentRoute: () => root,
  path: "/admin/programming/$trackId",
  component: () => (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <nav className="mb-6 text-sm">Admin / Programming / CrossFit.com</nav>
      <h1 className="mb-8 text-3xl font-semibold">
        Admin · CrossFit.com imports
      </h1>
      <CrossFitImportAdmin />
    </main>
  ),
})
const training = createRoute({
  getParentRoute: () => root,
  path: "/training",
  component: () => {
    const search = new URLSearchParams(location.search)
    return (
      <AthleteTraining
        context={previewContext}
        initialDate={search.get("date") ?? "2026-09-04"}
        initialTrackId="ptrk_crossfit_dotcom"
        libraryWorkoutIds={search.get("workoutIds")?.split(",")}
      />
    )
  },
})
const router = createRouter({
  routeTree: root.addChildren([reader, admin, training]),
})
document.documentElement.classList.add("dark")
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
)
