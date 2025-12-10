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

interface OrganizerRequestRejectedEmailProps {
	teamName?: string
	recipientName?: string
	adminNotes?: string
	supportEmail?: string
}

export const OrganizerRequestRejectedEmail = ({
	teamName = "CrossFit Downtown",
	recipientName = "John",
	adminNotes,
	supportEmail = "support@wodsmith.com",
}: OrganizerRequestRejectedEmailProps) => {
	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>Application Update</Heading>
					<Text style={paragraph}>Hello {recipientName},</Text>
					<Text style={paragraph}>
						Thank you for your interest in hosting competitions on WODsmith.
						After reviewing your application for <strong>{teamName}</strong>, we
						were unable to approve it at this time.
					</Text>

					{adminNotes && (
						<Section style={notesBox}>
							<Text style={notesLabel}>Feedback from our team:</Text>
							<Text style={notesText}>{adminNotes}</Text>
						</Section>
					)}

					<Text style={paragraph}>
						If you believe this was in error or would like to provide additional
						information, please contact our support team. We&apos;d be happy to
						discuss your application further.
					</Text>

					<Section style={buttonContainer}>
						<Link style={button} href={`mailto:${supportEmail}`}>
							Contact Support
						</Link>
					</Section>

					<Text style={paragraph}>
						You can also submit a new application in the future with updated
						information.
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

OrganizerRequestRejectedEmail.PreviewProps = {
	teamName: "CrossFit Downtown",
	recipientName: "John",
	adminNotes:
		"We need more information about your planned events and experience with competition organization. Please reach out to discuss further.",
	supportEmail: "support@wodsmith.com",
} as OrganizerRequestRejectedEmailProps

export default OrganizerRequestRejectedEmail

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

const notesBox = {
	backgroundColor: "#fef2f2",
	border: "1px solid #fecaca",
	borderRadius: "5px",
	padding: "16px",
	margin: "20px 0",
}

const notesLabel = {
	color: "#991b1b",
	fontSize: "12px",
	fontWeight: "600" as const,
	marginBottom: "8px",
}

const notesText = {
	color: "#991b1b",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
}

const buttonContainer = {
	textAlign: "center" as const,
	margin: "30px 0",
}

const button = {
	backgroundColor: "#525f7f",
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
