import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Section,
	Text,
} from "@react-email/components"
import { SITE_DOMAIN } from "@/constants"
import * as styles from "../styles"

interface OrganizerRequestApprovedEmailProps {
	teamName?: string
	recipientName?: string
	dashboardLink?: string
	adminNotes?: string
}

export const OrganizerRequestApprovedEmail = ({
	teamName = "CrossFit Downtown",
	recipientName = "John",
	dashboardLink = "https://example.com/compete/organizer",
	adminNotes,
}: OrganizerRequestApprovedEmailProps) => {
	return (
		<Html>
			<Head />
			<Body style={styles.main}>
				<Container style={styles.container}>
					<Text style={styles.logo}>WODsmith</Text>

					<Heading style={styles.heading}>You're approved!</Heading>

					<Text style={styles.paragraph}>
						Hi {recipientName}, your organizer application for{" "}
						<strong>{teamName}</strong> has been approved. You can now create
						and publish competitions on WODsmith.
					</Text>

					{adminNotes && (
						<Section style={styles.successBox}>
							<Text style={{ ...styles.boxText, fontStyle: "italic" }}>
								"{adminNotes}"
							</Text>
						</Section>
					)}

					<Section style={styles.buttonContainer}>
						<Link style={styles.button} href={dashboardLink}>
							Go to Dashboard
						</Link>
					</Section>

					<Text style={styles.muted}>
						<strong>Next steps:</strong>
						<br />• Create your first competition
						<br />• Set up registration and pricing
						<br />• Connect Stripe to receive payments
					</Text>

					<Hr style={styles.hr} />

					<Text style={styles.footer}>
						Need help? Check our organizer docs or contact support.
						<br />
						<br />
						<Link
							style={{ ...styles.link, fontSize: "12px" }}
							href={`https://${SITE_DOMAIN}`}
						>
							{SITE_DOMAIN}
						</Link>
					</Text>
				</Container>
			</Body>
		</Html>
	)
}

OrganizerRequestApprovedEmail.PreviewProps = {
	teamName: "CrossFit Downtown",
	recipientName: "John",
	dashboardLink: "https://example.com/compete/organizer",
	adminNotes:
		"Welcome to WODsmith Compete! Looking forward to seeing your events.",
} as OrganizerRequestApprovedEmailProps

export default OrganizerRequestApprovedEmail
