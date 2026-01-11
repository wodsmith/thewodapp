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

interface ResetPasswordEmailProps {
	resetLink?: string
	username?: string
}

export const ResetPasswordEmail = ({
	resetLink = "https://example.com/reset-password",
	username = "User",
}: ResetPasswordEmailProps) => (
	<Html>
		<Head />
		<Body style={styles.main}>
			<Container style={styles.container}>
				<Text style={styles.logo}>WODsmith</Text>

				<Heading style={styles.heading}>Reset your password</Heading>

				<Text style={styles.paragraph}>
					Hi {username}, we received a request to reset your password. Click the
					button below to choose a new one.
				</Text>

				<Section style={styles.buttonContainer}>
					<Link style={styles.button} href={resetLink}>
						Reset Password
					</Link>
				</Section>

				<Text style={styles.muted}>This link expires in 1 hour.</Text>

				<Text style={styles.muted}>
					If the button doesn't work, copy this link into your browser:
					<br />
					<Link style={styles.link} href={resetLink}>
						{resetLink}
					</Link>
				</Text>

				<Hr style={styles.hr} />

				<Text style={styles.footer}>
					Didn't request this? Ignore this email.
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

ResetPasswordEmail.PreviewProps = {
	resetLink: "https://example.com/reset-password?token=123",
	username: "johndoe",
} as ResetPasswordEmailProps

export default ResetPasswordEmail
