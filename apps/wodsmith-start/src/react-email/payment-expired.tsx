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
			<Body style={styles.main}>
				<Container style={styles.container}>
					<Text style={styles.logo}>WODsmith</Text>

					<Heading style={styles.heading}>Payment session expired</Heading>

					<Text style={styles.paragraph}>
						Hi {athleteName}, your payment session for{" "}
						<strong>{competitionName}</strong> ({divisionName}) expired. Your
						spot isn't lost — just complete checkout again.
					</Text>

					{registrationDeadline && (
						<Section style={styles.warningBox}>
							<Text style={styles.boxText}>
								Registration closes {registrationDeadline}
							</Text>
						</Section>
					)}

					<Section style={styles.buttonContainer}>
						<Link style={styles.button} href={registerUrl}>
							Complete Registration
						</Link>
					</Section>

					<Text style={styles.muted}>
						If the button doesn't work, copy this link into your browser:
						<br />
						<Link style={styles.link} href={registerUrl}>
							{registerUrl}
						</Link>
					</Text>

					<Hr style={styles.hr} />

					<Text style={styles.footer}>
						Questions? Contact the competition organizer.
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

PaymentExpiredEmail.PreviewProps = {
	athleteName: "John Smith",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	divisionName: "RX Male",
	registrationDeadline: "March 10, 2025",
} as PaymentExpiredProps

export default PaymentExpiredEmail
