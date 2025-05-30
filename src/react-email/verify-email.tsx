import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS, SITE_DOMAIN } from "@/constants";

interface VerifyEmailProps {
  verificationLink?: string;
  username?: string;
}

export const VerifyEmail = ({
  verificationLink = "https://example.com/verify-email",
  username = "User",
}: VerifyEmailProps) => {
  const expirationHours = EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS / 60 / 60

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={preheader}>Verify your {SITE_DOMAIN} email</Heading>
          <Text style={paragraph}>Hi {username},</Text>
          <Text style={paragraph}>
            Thanks for signing up for {SITE_DOMAIN}! We need to verify your email address to complete your registration. Please click the button below to verify your email address.
          </Text>
          <Section style={buttonContainer}>
            <Link style={button} href={verificationLink}>
              Verify Email Address
            </Link>
          </Section>
          <Text style={paragraph}>
            This verification link will expire in {expirationHours} hour{expirationHours > 1 ? "s" : ""}. After that, you&apos;ll need to request a new verification email.
          </Text>
          <Text style={paragraph}>
            If you&apos;re having trouble with the button above, copy and paste this URL into your browser:
          </Text>
          <Text style={link}>{verificationLink}</Text>
          <Text style={paragraph}>
            If you didn&apos;t create an account on {SITE_DOMAIN}, you can safely ignore this email.
          </Text>
        </Container>
        <Text style={footer}>
          This is an automated message from {SITE_DOMAIN}. Please do not reply to this email.
        </Text>
      </Body>
    </Html>
  )
};

VerifyEmail.PreviewProps = {
  verificationLink: "https://example.com/verify-email?token=123",
  username: "johndoe",
} as VerifyEmailProps;

export default VerifyEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  marginTop: "30px",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #f0f0f0",
  borderRadius: "5px",
  boxShadow: "0 5px 10px rgba(20,50,70,.2)",
  marginTop: "20px",
  maxWidth: "600px",
  margin: "0 auto",
  padding: "40px",
};

const preheader = {
  color: "#525f7f",
  fontSize: "18px",
  textAlign: "center" as const,
  marginBottom: "30px",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
  marginBottom: "16px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "30px 0",
};

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
};

const link = {
  color: "#556cd6",
  fontSize: "14px",
  textAlign: "center" as const,
  textDecoration: "underline",
  margin: "16px 0 30px",
  wordBreak: "break-all" as const,
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  textAlign: "center" as const,
  margin: "20px 0",
};
