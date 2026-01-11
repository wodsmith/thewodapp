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
import {
	EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS,
	SITE_DOMAIN,
} from "@/constants"
import * as styles from "./styles"

interface VerifyEmailProps {
	verificationLink?: string
	username?: string
}

export const VerifyEmail = ({
	verificationLink = "https://example.com/verify-email",
	username = "User",
}: VerifyEmailProps) => {
	const expirationHours = EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS / 60 / 60

	return (
		<Html>
			<Head />
			<Body style={styles.main}>
				<Container style={styles.container}>
					<Text style={styles.logo}>WODsmith</Text>

					<Heading style={styles.heading}>Verify your email</Heading>

					<Text style={styles.paragraph}>
						Hi {username}, click the button below to verify your email address
						and complete your registration.
					</Text>

					<Section style={styles.buttonContainer}>
						<Link style={styles.button} href={verificationLink}>
							Verify Email
						</Link>
					</Section>

					<Text style={styles.muted}>
						This link expires in {expirationHours} hour
						{expirationHours > 1 ? "s" : ""}.
					</Text>

					<Text style={styles.muted}>
						If the button doesn't work, copy this link into your browser:
						<br />
						<Link style={styles.link} href={verificationLink}>
							{verificationLink}
						</Link>
					</Text>

					<Hr style={styles.hr} />

					<Text style={styles.footer}>
						Didn't create an account? Ignore this email.
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

VerifyEmail.PreviewProps = {
	verificationLink: "https://example.com/verify-email?token=123",
	username: "johndoe",
} as VerifyEmailProps

export default VerifyEmail
