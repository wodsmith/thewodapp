import { createRoot } from "react-dom/client"
import { createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from "@tanstack/react-router"
import { AthleteTraining } from "@/components/training/athlete-training"
import { CoachPlanner } from "@/components/training/coach-planner"
import { context } from "./fixtures"
import "./preview.css"

const rootRoute = createRootRoute({component: () => <><header className="border-b border-border px-5 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><a href="/training" className="text-xl"><strong>WOD</strong>smith</a><span className="text-xs text-muted-foreground">Component preview · illustrative data · saved in this browser</span><nav className="flex gap-5 text-sm"><a href="/training">Athlete</a><a href="/training/programming">Coach</a><button type="button" onClick={() => document.documentElement.classList.toggle("dark")}>Change theme</button></nav></div></header><Outlet /></>})
const athlete = createRoute({getParentRoute: () => rootRoute, path: "/training", component: () => <AthleteTraining context={context} initialView={new URLSearchParams(location.search).get("view") === "team" ? "team" : "training"} />})
const coach = createRoute({getParentRoute: () => rootRoute, path: "/training/programming", component: () => <CoachPlanner context={context} />})
const router = createRouter({routeTree: rootRoute.addChildren([athlete, coach])})
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />)
