import {
	Body,
	Container,
	Head,
	Html,
	Link,
	Text,
} from "@react-email/components"
import { SITE_DOMAIN } from "@/constants"

interface OrganizerSignupWelcomeEmailProps {
	recipientName?: string
}

export const OrganizerSignupWelcomeEmail = ({
	recipientName = "there",
}: OrganizerSignupWelcomeEmailProps) => {
	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Text style={paragraph}>
						Hi{recipientName ? ` ${recipientName}` : ""},
					</Text>

					<Text style={paragraph}>
						My name is Zac, I am a co-founder of WODsmith. This is an automated
						email, but if you reply it will go straight to me.
					</Text>

					<Text style={paragraph}>
						If you have any feedback or comments on running competitions I would
						love to hear it. If you need help setting up your event or have
						questions about WODsmith Compete please get in touch. We would be
						happy to assist you.
					</Text>

					<Text style={paragraph}>
						Thanks,
						<br />
						Zac
					</Text>
				</Container>
				<Text style={footer}>
					<Link href={`https://${SITE_DOMAIN}`} style={footerLink}>
						{SITE_DOMAIN}
					</Link>
				</Text>
			</Body>
		</Html>
	)
}

OrganizerSignupWelcomeEmail.PreviewProps = {
	recipientName: "John",
} as OrganizerSignupWelcomeEmailProps

export default OrganizerSignupWelcomeEmail

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

const paragraph = {
	color: "#525f7f",
	fontSize: "16px",
	lineHeight: "24px",
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

const footerLink = {
	color: "#8898aa",
	textDecoration: "none",
}
