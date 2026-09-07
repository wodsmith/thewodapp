import { Button } from "@/components/ui/button"

/** Standalone previews cannot connect to the authenticated import service. */
export function WorkoutImportEntry() {
  return <Button variant="outline" className="min-h-11" disabled title="Workout import is available in the live app">Import workout (live app)</Button>
}
