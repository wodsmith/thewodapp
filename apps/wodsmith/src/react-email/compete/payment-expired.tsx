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

export interface PaymentExpiredProps {
	athleteName?: string
	competitionName?: string
	competitionSlug?: string
	divisionName?: string
	registrationDeadline?: string
}

export const PaymentExpiredEmail = ({
	athleteName = "Athlete",
	competitionName = "Competition",
	competitionSlug = "competition",
	divisionName = "Division",
	registrationDeadline,
}: PaymentExpiredProps) => {
	const registerUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}/register`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>Payment Session Expired</Heading>
					<Text style={paragraph}>Hi {athleteName},</Text>
					<Text style={paragraph}>
						Your payment session for <strong>{competitionName}</strong> (
						{divisionName}) has expired. Don&apos;t worry — your spot isn&apos;t
						lost yet!
					</Text>

					<Text style={paragraph}>
						To complete your registration, simply start the checkout process
						again.
					</Text>

					{registrationDeadline && (
						<Section style={warningBox}>
							<Text style={warningText}>
								⏰ Registration closes {registrationDeadline}
							</Text>
						</Section>
					)}

					<Section style={buttonContainer}>
						<Link style={button} href={registerUrl}>
							Complete Registration
						</Link>
					</Section>

					<Text style={paragraph}>
						If you&apos;re having trouble with the button above, copy and paste
						this URL into your browser:
					</Text>
					<Text style={link}>{registerUrl}</Text>

					<Text style={paragraph}>
						If you have any questions, please contact the competition organizer.
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

PaymentExpiredEmail.PreviewProps = {
	athleteName: "John Smith",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	divisionName: "RX Male",
	registrationDeadline: "March 10, 2025",
} as PaymentExpiredProps

export default PaymentExpiredEmail

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
	maxWidth: "600px",
	margin: "20px auto 0",
	padding: "40px",
}

const preheader = {
	color: "#ef4444",
	fontSize: "20px",
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

const warningBox = {
	backgroundColor: "#fef3c7",
	border: "1px solid #f59e0b",
	borderRadius: "5px",
	padding: "16px",
	marginBottom: "24px",
}

const warningText = {
	color: "#92400e",
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

const link = {
	color: "#556cd6",
	fontSize: "14px",
	textAlign: "center" as const,
	textDecoration: "underline",
	margin: "16px 0 30px",
	wordBreak: "break-all" as const,
}

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	margin: "20px 0",
}
