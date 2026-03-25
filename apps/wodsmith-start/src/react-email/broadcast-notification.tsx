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

export interface BroadcastNotificationProps {
	competitionName?: string
	competitionSlug?: string
	broadcastTitle?: string
	broadcastBody?: string
	organizerTeamName?: string
}

export const BroadcastNotificationEmail = ({
	competitionName = "Competition",
	competitionSlug = "competition",
	broadcastTitle = "Announcement",
	broadcastBody = "This is a broadcast message from the organizer.",
	organizerTeamName = "Organizer",
}: BroadcastNotificationProps) => {
	const competitionUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Text style={fromLine}>
						From <strong>{organizerTeamName}</strong> &middot;{" "}
						{competitionName}
					</Text>

					<Heading style={heading}>{broadcastTitle}</Heading>

					<Section style={bodySection}>
						<Text style={bodyText}>{broadcastBody}</Text>
					</Section>

					<Section style={buttonContainer}>
						<Link style={button} href={competitionUrl}>
							View Competition
						</Link>
					</Section>

					<Text style={paragraph}>
						You are receiving this because you are registered for{" "}
						{competitionName}.
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

BroadcastNotificationEmail.PreviewProps = {
	competitionName: "CrossFit Open 2026",
	competitionSlug: "crossfit-open-2026",
	broadcastTitle: "Schedule Change for Saturday",
	broadcastBody:
		"Hey athletes! We've moved the start time for Saturday from 8:00 AM to 9:00 AM due to weather. Please plan accordingly. See you there!",
	organizerTeamName: "CrossFit HQ",
} as BroadcastNotificationProps

export default BroadcastNotificationEmail

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

const fromLine = {
	color: "#8898aa",
	fontSize: "13px",
	lineHeight: "20px",
	marginBottom: "8px",
}

const heading = {
	color: "#1e293b",
	fontSize: "22px",
	lineHeight: "30px",
	marginBottom: "24px",
}

const bodySection = {
	backgroundColor: "#f8fafc",
	border: "1px solid #e2e8f0",
	borderRadius: "5px",
	padding: "20px",
	marginBottom: "24px",
}

const bodyText = {
	color: "#334155",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0",
	whiteSpace: "pre-wrap" as const,
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

const paragraph = {
	color: "#525f7f",
	fontSize: "14px",
	lineHeight: "20px",
	textAlign: "left" as const,
	marginBottom: "16px",
}

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	margin: "20px 0",
}
