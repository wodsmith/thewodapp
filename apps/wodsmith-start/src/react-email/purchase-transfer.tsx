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

export interface PurchaseTransferEmailProps {
  sourceAthleteName?: string
  competitionName?: string
  divisionName?: string
  transferId?: string
  appUrl?: string
  expiresAt?: string
}

export const PurchaseTransferEmail = ({
  sourceAthleteName = "An athlete",
  competitionName = "Competition",
  divisionName = "Division",
  transferId = "transfer_example",
  appUrl = `https://${SITE_DOMAIN}`,
  expiresAt,
}: PurchaseTransferEmailProps) => {
  const transferUrl = `${appUrl}/transfer/${transferId}`

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={preheader}>Registration Transfer</Heading>
          <Text style={paragraph}>
            {sourceAthleteName} has transferred a registration to you for{" "}
            <strong>{competitionName}</strong> in the{" "}
            <strong>{divisionName}</strong> division.
          </Text>

          <Section style={buttonContainer}>
            <Link style={button} href={transferUrl}>
              Accept Transfer
            </Link>
          </Section>

          {expiresAt && (
            <Text style={paragraph}>This transfer expires on {expiresAt}.</Text>
          )}

          <Text style={paragraph}>
            If you were not expecting this transfer, you can safely ignore this
            email.
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

PurchaseTransferEmail.PreviewProps = {
  sourceAthleteName: "Jane Smith",
  competitionName: "CrossFit Open 2025",
  divisionName: "RX Female",
  transferId: "transfer_mbwft7k18l8niqu9s39zv1hf",
  appUrl: `https://${SITE_DOMAIN}`,
  expiresAt: "March 15, 2025",
} as PurchaseTransferEmailProps

export default PurchaseTransferEmail

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
  margin: "20px auto",
  padding: "40px",
}

const preheader = {
  color: "#525f7f",
  fontSize: "24px",
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

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  textAlign: "center" as const,
  margin: "20px 0",
}
