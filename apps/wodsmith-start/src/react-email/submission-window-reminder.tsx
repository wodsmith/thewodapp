import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Section,
	Text,
} from "@react-email/components"
import { SITE_DOMAIN } from "@/constants"

export interface SubmissionWindowReminderProps {
	athleteName?: string
	competitionName?: string
	competitionSlug?: string
	workoutName?: string
	workoutDescription?: string
	submissionClosesAt?: string
	timezone?: string
	/** Time remaining until window closes (e.g., "24 hours", "1 hour") */
	timeRemaining?: string
}

export const SubmissionWindowReminderEmail = ({
	athleteName = "Athlete",
	competitionName = "Competition",
	competitionSlug = "competition",
	workoutName = "Workout 1",
	workoutDescription,
	submissionClosesAt,
	timezone = "UTC",
	timeRemaining = "24 hours",
}: SubmissionWindowReminderProps) => {
	const competitionUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>{timeRemaining} Left to Submit!</Heading>
					<Text style={paragraph}>Hi {athleteName},</Text>
					<Text style={paragraph}>
						This is a reminder that the submission window for{" "}
						<strong>{workoutName}</strong> in <strong>{competitionName}</strong>{" "}
						closes in <strong>{timeRemaining}</strong>.
					</Text>

					<Section style={warningBox}>
						<Text style={warningText}>
							Don&apos;t miss your chance to submit! The window closes on{" "}
							{submissionClosesAt} ({timezone}).
						</Text>
					</Section>

					<Section style={detailsBox}>
						<Text style={detailsTitle}>Event Details</Text>
						<Text style={detailRow}>
							<strong>Competition:</strong> {competitionName}
						</Text>
						<Text style={detailRow}>
							<strong>Event:</strong> {workoutName}
						</Text>
						{workoutDescription && (
							<Text style={detailRow}>
								<strong>Description:</strong> {workoutDescription}
							</Text>
						)}
						<Text style={detailRow}>
							<strong>Deadline:</strong> {submissionClosesAt} ({timezone})
						</Text>
					</Section>

					<Section style={buttonContainer}>
						<Link style={button} href={competitionUrl}>
							Submit Your Score Now
						</Link>
					</Section>

					<Text style={paragraph}>
						If you&apos;ve already submitted your score, you can ignore this
						reminder. Good luck!
					</Text>
				</Container>
				<Text style={footer}>
					This is an automated message from {SITE_DOMAIN}. Please do not reply
					to this email.
				</Text>
			</Body>
		</Html>
	)
}

SubmissionWindowReminderEmail.PreviewProps = {
	athleteName: "John Smith",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	workoutName: "25.1",
	workoutDescription: "15-12-9 Thrusters and Bar Muscle-ups",
	submissionClosesAt: "Monday, March 17, 2025 at 5:00 PM",
	timezone: "America/Denver",
	timeRemaining: "24 hours",
} as SubmissionWindowReminderProps

export default SubmissionWindowReminderEmail

const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
	marginTop: "30px",
}

const container = {
	backgroundColor: "#ffffff",
	border: "1px solid #f0f0f0",
	borderRadius: "5px",
	boxShadow: "0 5px 10px rgba(20,50,70,.2)",
	marginTop: "20px",
	maxWidth: "600px",
	margin: "20px auto",
	padding: "40px",
}

const preheader = {
	color: "#f59e0b",
	fontSize: "24px",
	textAlign: "center" as const,
	marginBottom: "30px",
}

const paragraph = {
	color: "#525f7f",
	fontSize: "16px",
	lineHeight: "24px",
	textAlign: "left" as const,
	marginBottom: "16px",
}

const warningBox = {
	backgroundColor: "#fef3c7",
	border: "1px solid #f59e0b",
	borderRadius: "5px",
	padding: "16px",
	marginBottom: "24px",
}

const warningText = {
	color: "#92400e",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
}

const detailsBox = {
	backgroundColor: "#f8fafc",
	border: "1px solid #e2e8f0",
	borderRadius: "5px",
	padding: "20px",
	marginBottom: "24px",
}

const detailsTitle = {
	color: "#1e293b",
	fontSize: "14px",
	fontWeight: "bold" as const,
	textTransform: "uppercase" as const,
	letterSpacing: "0.5px",
	marginBottom: "12px",
	marginTop: "0",
}

const detailRow = {
	color: "#525f7f",
	fontSize: "15px",
	lineHeight: "20px",
	margin: "8px 0",
}

const buttonContainer = {
	textAlign: "center" as const,
	margin: "30px 0",
}

const button = {
	backgroundColor: "#f59e0b",
	borderRadius: "5px",
	color: "#fff",
	display: "inline-block",
	fontSize: "16px",
	fontWeight: "bold",
	textDecoration: "none",
	textAlign: "center" as const,
	padding: "13px 40px",
	margin: "0 auto",
}

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	margin: "20px 0",
}
