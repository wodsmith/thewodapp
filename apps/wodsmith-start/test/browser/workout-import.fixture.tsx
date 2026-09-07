/** TEST ONLY: renders the real review UI with a fixed proposal; no model or save service. */
import { createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router"
import { createRoot } from "react-dom/client"
import { WorkoutImportWorkspace } from "@/components/workout-import/workout-import-workspace"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { emptyImportWorkout } from "@/components/workout-import/editor-adapter"
import "@/styles.css"
const route = createRootRoute({ component: () => <Dialog defaultOpen><DialogContent onInteractOutside={(event) => event.preventDefault()} className="flex max-h-[100dvh] flex-col overflow-hidden sm:max-h-[90dvh] sm:max-w-3xl"><DialogHeader><DialogTitle>Import workout</DialogTitle><DialogDescription>Paste a workout or upload a screenshot. Review the prescription and scoring before creating it.</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto px-1 pb-2"><WorkoutImportWorkspace destinationLabel="Private workout · Personal team" saveLabel="Create workout" stage="Workout proposal ready for review." busy={false} accessRequired={false} error={null} movements={[]} draft={{ schemaVersion: 1, importId: "fixture", revision: 1, requestId: "fixture-request", source: { text: "3 rounds for time:\n400 m run\n15 kettlebell swings (24/16 kg)\n12 pull-ups\n12 minute time cap" }, status: "ready", workout: { ...emptyImportWorkout, name: "Run, Swing, Pull", description: "3 rounds for time:\n400 m run\n15 kettlebell swings (24/16 kg)\n12 pull-ups\nTime cap: 12 minutes", scheme: "time-with-cap", scoreType: "min", timeCapSeconds: 720, roundsToScore: 1 }, extractedText: "", unresolved: [], warnings: [{ message: "Suggested title. You can edit it below.", sourceExcerpt: "" }], changedFields: [] }} onRead={async () => {}} onRevise={async () => {}} onSave={async () => {}} onCancel={async () => {}} onClose={() => {}} onCheckAccess={() => {}} /></div></DialogContent></Dialog> })
const router = createRouter({ routeTree: route })
const root = document.getElementById("root")
if (root) createRoot(root).render(<RouterProvider router={router} />)
