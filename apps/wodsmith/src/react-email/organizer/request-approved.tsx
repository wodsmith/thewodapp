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

interface OrganizerRequestApprovedEmailProps {
	teamName?: string
	recipientName?: string
	dashboardLink?: string
	adminNotes?: string
}

export const OrganizerRequestApprovedEmail = ({
	teamName = "CrossFit Downtown",
	recipientName = "John",
	dashboardLink = "https://wodsmith.com/compete/organizer",
	adminNotes,
}: OrganizerRequestApprovedEmailProps) => {
	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>Your Application is Approved!</Heading>
					<Text style={paragraph}>Hello {recipientName},</Text>
					<Text style={paragraph}>
						Great news! Your organizer application for{" "}
						<strong>{teamName}</strong> has been approved. You can now create
						and publish public competitions on WODsmith Compete.
					</Text>

					{adminNotes && (
						<Section style={notesBox}>
							<Text style={notesLabel}>Note from admin:</Text>
							<Text style={notesText}>{adminNotes}</Text>
						</Section>
					)}

					<Section style={buttonContainer}>
						<Link style={button} href={dashboardLink}>
							Go to Organizer Dashboard
						</Link>
					</Section>

					<Text style={paragraph}>Here&apos;s what you can do next:</Text>
					<Text style={listItem}>
						- Create and publish your first competition
					</Text>
					<Text style={listItem}>- Set up registration and pricing</Text>
					<Text style={listItem}>
						- Connect Stripe to receive registration payments
					</Text>

					<Text style={paragraph}>
						Need help getting started? Check out our organizer documentation or
						contact support.
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

OrganizerRequestApprovedEmail.PreviewProps = {
	teamName: "CrossFit Downtown",
	recipientName: "John",
	dashboardLink: "https://wodsmith.com/compete/organizer",
	adminNotes: "Welcome to WODsmith Compete! Looking forward to seeing your events.",
} as OrganizerRequestApprovedEmailProps

export default OrganizerRequestApprovedEmail

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
	backgroundColor: "#f0fdf4",
	border: "1px solid #86efac",
	borderRadius: "5px",
	padding: "16px",
	margin: "20px 0",
}

const notesLabel = {
	color: "#166534",
	fontSize: "12px",
	fontWeight: "600" as const,
	marginBottom: "8px",
}

const notesText = {
	color: "#166534",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
}

const listItem = {
	color: "#525f7f",
	fontSize: "14px",
	lineHeight: "24px",
	marginBottom: "8px",
}

const buttonContainer = {
	textAlign: "center" as const,
	margin: "30px 0",
}

const button = {
	backgroundColor: "#22c55e",
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
