import { redirect } from "next/navigation"

export default function ScheduleGeneratePage() {
	// Redirect to main schedule page for now
	redirect("/admin/teams/schedule")
}
