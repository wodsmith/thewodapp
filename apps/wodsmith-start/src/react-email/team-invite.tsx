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
import * as styles from "./styles"

interface TeamInviteEmailProps {
	inviteLink?: string
	recipientEmail?: string
	teamName?: string
	inviterName?: string
}

export const TeamInviteEmail = ({
	inviteLink = "https://example.com/accept-invite",
	recipientEmail = "user@example.com",
	teamName = "Team",
	inviterName = "Someone",
}: TeamInviteEmailProps) => {
	return (
		<Html>
			<Head />
			<Body style={styles.main}>
				<Container style={styles.container}>
					<Text style={styles.logo}>WODsmith</Text>

					<Heading style={styles.heading}>You've been invited</Heading>

					<Text style={styles.paragraph}>
						<strong>{inviterName}</strong> invited you to join{" "}
						<strong>{teamName}</strong> on WODsmith.
					</Text>

					<Section style={styles.buttonContainer}>
						<Link style={styles.button} href={inviteLink}>
							Accept Invitation
						</Link>
					</Section>

					<Text style={styles.muted}>
						This invitation was sent to {recipientEmail}. If you don't have an
						account yet, you'll be able to create one when you accept.
					</Text>

					<Text style={styles.muted}>
						If the button doesn't work, copy this link into your browser:
						<br />
						<Link style={styles.link} href={inviteLink}>
							{inviteLink}
						</Link>
					</Text>

					<Hr style={styles.hr} />

					<Text style={styles.footer}>
						Didn't expect this? Ignore this email.
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

TeamInviteEmail.PreviewProps = {
	inviteLink: "https://example.com/accept-invite?token=123",
	recipientEmail: "user@example.com",
	teamName: "Acme Inc",
	inviterName: "Jane Doe",
} as TeamInviteEmailProps

export default TeamInviteEmail
