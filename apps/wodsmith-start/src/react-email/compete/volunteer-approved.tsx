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

export interface VolunteerApprovedProps {
	volunteerName?: string
	competitionName?: string
	competitionSlug?: string
	competitionDate?: string
	roleTypes?: string[]
}

/**
 * Email sent to volunteers when their application is approved by organizers.
 * Includes their assigned role types and next steps.
 */
export const VolunteerApprovedEmail = ({
	volunteerName = "Volunteer",
	competitionName = "Competition",
	competitionSlug = "competition",
	competitionDate,
	roleTypes = [],
}: VolunteerApprovedProps) => {
	const competitionUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>You&apos;re approved!</Heading>
					<Text style={paragraph}>Hi {volunteerName},</Text>
					<Text style={paragraph}>
						Great news! You&apos;ve been approved to volunteer at{" "}
						<Link href={competitionUrl} style={inlineLink}>
							{competitionName}
						</Link>
						. Thank you for offering your time to help make this event a
						success!
					</Text>

					<Section style={detailsBox}>
						<Text style={detailsTitle}>Volunteer Details</Text>
						<Text style={detailRow}>
							<strong>Competition:</strong> {competitionName}
						</Text>
						{competitionDate && (
							<Text style={detailRow}>
								<strong>Date:</strong> {competitionDate}
							</Text>
						)}
						{roleTypes.length > 0 && (
							<Text style={detailRow}>
								<strong>Role{roleTypes.length > 1 ? "s" : ""}:</strong>{" "}
								{roleTypes.join(", ")}
							</Text>
						)}
					</Section>

					<Section style={successBox}>
						<Text style={successText}>
							The organizers will reach out with more details about your
							schedule and specific assignments closer to the event date.
						</Text>
					</Section>

					<Section style={buttonContainer}>
						<Link style={button} href={competitionUrl}>
							View Competition
						</Link>
					</Section>

					<Text style={paragraph}>
						If you have any questions about your volunteer role, please contact
						the competition organizers directly.
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

VolunteerApprovedEmail.PreviewProps = {
	volunteerName: "Sarah",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	competitionDate: "Saturday, March 15, 2025",
	roleTypes: ["Judge", "Scorekeeper"],
} as VolunteerApprovedProps

export default VolunteerApprovedEmail

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
	margin: "0 auto",
	padding: "40px",
}

const preheader = {
	color: "#22c55e",
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

const inlineLink = {
	color: "#556cd6",
	textDecoration: "underline",
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
	lineHeight: "22px",
	margin: "8px 0",
}

const successBox = {
	backgroundColor: "#dcfce7",
	border: "1px solid #86efac",
	borderRadius: "5px",
	padding: "16px",
	marginBottom: "24px",
}

const successText = {
	color: "#166534",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
	textAlign: "center" as const,
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
