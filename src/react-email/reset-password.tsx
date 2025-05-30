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
import { SITE_DOMAIN } from "@/constants";

interface ResetPasswordEmailProps {
  resetLink?: string;
  username?: string;
}

export const ResetPasswordEmail = ({
  resetLink = "https://example.com/reset-password",
  username = "User",
}: ResetPasswordEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Heading style={preheader}>Reset your {SITE_DOMAIN} password</Heading>
        <Text style={paragraph}>Hi {username},</Text>
        <Text style={paragraph}>
          We received a request to reset your password for your {SITE_DOMAIN} account. Click the button below to choose a new password. For security reasons, this link will expire in 1 hour.
        </Text>
        <Section style={buttonContainer}>
          <Link style={button} href={resetLink}>
            Reset Password
          </Link>
        </Section>
        <Text style={paragraph}>
          If you didn&apos;t request this password reset, you can safely ignore this email. Your {SITE_DOMAIN} account password will remain unchanged.
        </Text>
        <Text style={paragraph}>
          If you&apos;re having trouble with the button above, copy and paste this URL into your browser:
        </Text>
        <Text style={link}>{resetLink}</Text>
      </Container>
      <Text style={footer}>
        This is an automated message from {SITE_DOMAIN}. If you did not request this email, please ignore it or contact support if you have concerns.
      </Text>
    </Body>
  </Html>
);

ResetPasswordEmail.PreviewProps = {
  resetLink: "https://example.com/reset-password?token=123",
  username: "johndoe",
} as ResetPasswordEmailProps;

export default ResetPasswordEmail;

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
