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

export interface SubmissionWindowClosedProps {
	athleteName?: string
	competitionName?: string
	competitionSlug?: string
	workoutName?: string
	/** Whether the athlete submitted a score before the window closed */
	hasSubmitted?: boolean
}

export const SubmissionWindowClosedEmail = ({
	athleteName = "Athlete",
	competitionName = "Competition",
	competitionSlug = "competition",
	workoutName = "Workout 1",
	hasSubmitted = false,
}: SubmissionWindowClosedProps) => {
	const competitionUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={hasSubmitted ? preheaderSuccess : preheaderInfo}>
						Submission Window Closed
					</Heading>
					<Text style={paragraph}>Hi {athleteName},</Text>

					{hasSubmitted ? (
						<>
							<Text style={paragraph}>
								The submission window for <strong>{workoutName}</strong> in{" "}
								<strong>{competitionName}</strong> has closed.
							</Text>
							<Section style={successBox}>
								<Text style={successText}>
									Your score has been recorded. Thank you for participating!
								</Text>
							</Section>
						</>
					) : (
						<>
							<Text style={paragraph}>
								The submission window for <strong>{workoutName}</strong> in{" "}
								<strong>{competitionName}</strong> has closed.
							</Text>
							<Section style={infoBox}>
								<Text style={infoText}>
									We noticed you didn&apos;t submit a score for this event. If
									you believe this is an error, please contact the competition
									organizer.
								</Text>
							</Section>
						</>
					)}

					<Section style={detailsBox}>
						<Text style={detailsTitle}>Event Details</Text>
						<Text style={detailRow}>
							<strong>Competition:</strong> {competitionName}
						</Text>
						<Text style={detailRow}>
							<strong>Event:</strong> {workoutName}
						</Text>
						<Text style={detailRow}>
							<strong>Status:</strong>{" "}
							{hasSubmitted ? "Score Submitted" : "No Score Submitted"}
						</Text>
					</Section>

					<Section style={buttonContainer}>
						<Link style={button} href={competitionUrl}>
							View Competition
						</Link>
					</Section>

					<Text style={paragraph}>
						Stay tuned for the next event and check the competition page for
						updates on the leaderboard!
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

SubmissionWindowClosedEmail.PreviewProps = {
	athleteName: "John Smith",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	workoutName: "25.1",
	hasSubmitted: true,
} as SubmissionWindowClosedProps

export default SubmissionWindowClosedEmail

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

const preheaderSuccess = {
	color: "#22c55e",
	fontSize: "24px",
	textAlign: "center" as const,
	marginBottom: "30px",
}

const preheaderInfo = {
	color: "#6b7280",
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

const successBox = {
	backgroundColor: "#dcfce7",
	border: "1px solid #22c55e",
	borderRadius: "5px",
	padding: "16px",
	marginBottom: "24px",
}

const successText = {
	color: "#166534",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
}

const infoBox = {
	backgroundColor: "#f3f4f6",
	border: "1px solid #9ca3af",
	borderRadius: "5px",
	padding: "16px",
	marginBottom: "24px",
}

const infoText = {
	color: "#4b5563",
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
	backgroundColor: "#000",
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
