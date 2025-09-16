import { redirect } from "next/navigation"

export default function ScheduleClassesPage() {
	// Redirect to main schedule page for now
	redirect("/admin/teams/schedule")
}
