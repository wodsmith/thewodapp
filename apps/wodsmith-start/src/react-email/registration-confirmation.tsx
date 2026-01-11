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

export interface RegistrationConfirmationProps {
	athleteName?: string
	competitionName?: string
	competitionSlug?: string
	registrationId?: string
	competitionDate?: string
	divisionName?: string
	teamName?: string
	pendingTeammateCount?: number
	isPaid?: boolean
	amountPaidFormatted?: string
}

export const RegistrationConfirmationEmail = ({
	athleteName = "Athlete",
	competitionName = "Competition",
	competitionSlug = "competition",
	registrationId = "creg_example",
	competitionDate,
	divisionName = "Division",
	teamName,
	pendingTeammateCount,
	isPaid = false,
	amountPaidFormatted,
}: RegistrationConfirmationProps) => {
	const registrationUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}/teams/${registrationId}`

	return (
		<Html>
			<Head />
			<Body style={styles.main}>
				<Container style={styles.container}>
					<Text style={styles.logo}>WODsmith</Text>

					<Heading style={styles.heading}>You're in!</Heading>

					<Text style={styles.paragraph}>
						Hi {athleteName}, your registration for{" "}
						<strong>{competitionName}</strong> is confirmed.
					</Text>

					<Section style={styles.infoBox}>
						<Text style={styles.infoLabel}>Competition</Text>
						<Text style={styles.infoValue}>{competitionName}</Text>

						{competitionDate && (
							<>
								<Text style={styles.infoLabel}>Date</Text>
								<Text style={styles.infoValue}>{competitionDate}</Text>
							</>
						)}

						<Text style={styles.infoLabel}>Division</Text>
						<Text style={styles.infoValue}>{divisionName}</Text>

						{teamName && (
							<>
								<Text style={styles.infoLabel}>Team</Text>
								<Text style={styles.infoValue}>{teamName}</Text>
							</>
						)}

						{isPaid && amountPaidFormatted && (
							<>
								<Text style={styles.infoLabel}>Amount Paid</Text>
								<Text style={{ ...styles.infoValue, marginBottom: 0 }}>
									{amountPaidFormatted}
								</Text>
							</>
						)}
					</Section>

					{pendingTeammateCount !== undefined && pendingTeammateCount > 0 && (
						<Section style={styles.warningBox}>
							<Text style={styles.boxText}>
								{pendingTeammateCount} teammate
								{pendingTeammateCount === 1 ? "" : "s"} still need
								{pendingTeammateCount === 1 ? "s" : ""} to accept your
								invitation.
							</Text>
						</Section>
					)}

					<Section style={styles.buttonContainer}>
						<Link style={styles.button} href={registrationUrl}>
							View Registration
						</Link>
					</Section>

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

RegistrationConfirmationEmail.PreviewProps = {
	athleteName: "John Smith",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	registrationId: "creg_mbwft7k18l8niqu9s39zv1hf",
	competitionDate: "March 15, 2025",
	divisionName: "RX Male",
	teamName: "Team Alpha",
	pendingTeammateCount: 2,
	isPaid: true,
	amountPaidFormatted: "$50.00",
} as RegistrationConfirmationProps

export default RegistrationConfirmationEmail
