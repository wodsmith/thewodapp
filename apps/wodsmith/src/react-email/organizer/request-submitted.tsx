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

interface OrganizerRequestSubmittedEmailProps {
	teamName?: string
	requesterName?: string
	requesterEmail?: string
	reason?: string
	reviewLink?: string
}

export const OrganizerRequestSubmittedEmail = ({
	teamName = "CrossFit Downtown",
	requesterName = "John Doe",
	requesterEmail = "john@example.com",
	reason = "We want to host local throwdowns for our community.",
	reviewLink = "https://wodsmith.com/admin/organizer-requests",
}: OrganizerRequestSubmittedEmailProps) => {
	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>New Organizer Application</Heading>
					<Text style={paragraph}>Hello Admin,</Text>
					<Text style={paragraph}>
						A new organizer application has been submitted and requires your
						review.
					</Text>

					<Section style={detailsBox}>
						<Text style={detailLabel}>Team</Text>
						<Text style={detailValue}>{teamName}</Text>

						<Text style={detailLabel}>Requested by</Text>
						<Text style={detailValue}>
							{requesterName} ({requesterEmail})
						</Text>

						<Text style={detailLabel}>Reason for organizing</Text>
						<Text style={detailValue}>{reason}</Text>
					</Section>

					<Section style={buttonContainer}>
						<Link style={button} href={reviewLink}>
							Review Application
						</Link>
					</Section>

					<Text style={paragraph}>
						You can approve or reject this application from the admin dashboard.
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

OrganizerRequestSubmittedEmail.PreviewProps = {
	teamName: "CrossFit Downtown",
	requesterName: "John Doe",
	requesterEmail: "john@example.com",
	reason:
		"We want to host local throwdowns and community competitions. We have experience running events and want to use WODsmith to manage registrations and scoring.",
	reviewLink: "https://wodsmith.com/admin/organizer-requests",
} as OrganizerRequestSubmittedEmailProps

export default OrganizerRequestSubmittedEmail

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
	color: "#525f7f",
	fontSize: "18px",
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

const detailsBox = {
	backgroundColor: "#f8f9fa",
	borderRadius: "5px",
	padding: "20px",
	margin: "20px 0",
}

const detailLabel = {
	color: "#8898aa",
	fontSize: "12px",
	fontWeight: "600" as const,
	textTransform: "uppercase" as const,
	marginBottom: "4px",
}

const detailValue = {
	color: "#525f7f",
	fontSize: "14px",
	lineHeight: "20px",
	marginBottom: "16px",
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
