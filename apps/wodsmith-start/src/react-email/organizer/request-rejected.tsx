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
			<Body style={styles.main}>
				<Container style={styles.container}>
					<Text style={styles.logo}>WODsmith</Text>

					<Heading style={styles.heading}>Application update</Heading>

					<Text style={styles.paragraph}>
						Hi {recipientName}, thanks for your interest in hosting competitions
						on WODsmith. After reviewing your application for{" "}
						<strong>{teamName}</strong>, we weren't able to approve it at this
						time.
					</Text>

					{adminNotes && (
						<Section style={styles.errorBox}>
							<Text style={styles.boxText}>{adminNotes}</Text>
						</Section>
					)}

					<Text style={styles.paragraph}>
						If you have questions or would like to provide more information,
						please reach out to our support team.
					</Text>

					<Section style={styles.buttonContainer}>
						<Link
							style={{ ...styles.button, backgroundColor: styles.colors.muted }}
							href={`mailto:${supportEmail}`}
						>
							Contact Support
						</Link>
					</Section>

					<Hr style={styles.hr} />

					<Text style={styles.footer}>
						You can submit a new application in the future.
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

OrganizerRequestRejectedEmail.PreviewProps = {
	teamName: "CrossFit Downtown",
	recipientName: "John",
	adminNotes:
		"We need more information about your planned events and experience with competition organization. Please reach out to discuss further.",
	supportEmail: "support@wodsmith.com",
} as OrganizerRequestRejectedEmailProps

export default OrganizerRequestRejectedEmail
