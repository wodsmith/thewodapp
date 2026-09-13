import {
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { createRoot } from "react-dom/client"
import { Route as CalculatorRoute } from "@/routes/_protected/calculator/index"
import { Route as SpreadsheetRoute } from "@/routes/_protected/calculator/spreadsheet/index"
import "./preview.css"

// Real calculator routes in an isolated browser fixture; no application services.
const root = createRootRoute({ component: Outlet })
const calculator = CalculatorRoute.update({
  id: "/calculator",
  path: "/calculator",
  getParentRoute: () => root,
} as Parameters<typeof CalculatorRoute.update>[0])
const spreadsheet = SpreadsheetRoute.update({
  id: "/calculator/spreadsheet",
  path: "/calculator/spreadsheet",
  getParentRoute: () => root,
} as Parameters<typeof SpreadsheetRoute.update>[0])
const router = createRouter({
  routeTree: root.addChildren([calculator, spreadsheet]),
  context: { hasWorkoutTracking: true },
})
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
)
