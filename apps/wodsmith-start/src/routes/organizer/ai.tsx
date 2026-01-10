import { createFileRoute } from "@tanstack/react-router"
import { AIChat } from "@/components/ai-chat"

export const Route = createFileRoute("/organizer/ai")({
	component: OrganizerAIPage,
})

function OrganizerAIPage() {
	return (
		<div className="container max-w-4xl mx-auto py-8">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Competition Planner</h1>
				<p className="text-muted-foreground">
					AI assistant for planning and managing competitions
				</p>
			</div>
			<div className="border rounded-lg h-150">
				<AIChat />
			</div>
		</div>
	)
}
