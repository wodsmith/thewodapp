import CreateTrackForm from "@/components/tracks/CreateTrackForm"

export default function Page() {
	return (
		<main className="container mx-auto p-4">
			<h1 className="text-2xl font-semibold mb-4">Create Programming Track</h1>
			<CreateTrackForm />
		</main>
	)
}
