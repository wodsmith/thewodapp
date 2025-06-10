import "server-only"

interface Props {
	instanceId: string
}

export default async function ScheduledWorkoutInstanceView({
	instanceId,
}: Props) {
	return <div>Scheduled Workout {instanceId}</div>
}
