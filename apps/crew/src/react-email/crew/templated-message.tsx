// @lat: [[crew#Confirmation Emails And Reminders]]
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
import { Fragment } from "react"
import {
  button,
  buttonContainer,
  container,
  footer,
  fromLine,
  heading,
  main,
  paragraph,
} from "./assignment-confirmation"

export interface CrewTemplatedMessageEmailProps {
  heading: string
  paragraphs: string[]
  cta?: {
    label: string
    url: string
  } | null
  footerText?: string
}

/**
 * Generic crew message layout. All crew message template types (assignment
 * confirmations, reminders, and custom broadcasts) render through this
 * component so their visual style stays consistent with the original
 * assignment-confirmation email.
 */
export const CrewTemplatedMessageEmail = ({
  heading: headingText,
  paragraphs,
  cta,
  footerText,
}: CrewTemplatedMessageEmailProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={fromLine}>WODsmith Crew</Text>
          <Heading style={heading}>{headingText}</Heading>
          {paragraphs.map((text, index) => (
            <Text key={`${index}-${text.slice(0, 16)}`} style={paragraph}>
              {renderParagraphLines(text)}
            </Text>
          ))}
          {cta ? (
            <Section style={buttonContainer}>
              <Link style={button} href={cta.url}>
                {cta.label}
              </Link>
            </Section>
          ) : null}
        </Container>
        {footerText ? <Text style={footer}>{footerText}</Text> : null}
      </Body>
    </Html>
  )
}

CrewTemplatedMessageEmail.PreviewProps = {
  heading: "Confirm your assignment",
  paragraphs: [
    "Hi Ada,",
    "You are assigned to help with Mountain West Throwdown. Please confirm that this shift still works for you.",
    "Shift: Lane judging block 1\nRole: Judge\nTime: Sat, Jun 27 9:00 AM - 11:00 AM\nLocation: Floor 1",
  ],
  cta: {
    label: "Review and respond",
    url: "https://crew.wodsmith.com/e/mountain-west-throwdown/confirm/example",
  },
  footerText:
    "This assignment link is private to you. No WODsmith account is required to respond.",
} as CrewTemplatedMessageEmailProps

export default CrewTemplatedMessageEmail

function renderParagraphLines(text: string) {
  const lines = text.split("\n")
  return lines.map((line, index) => (
    <Fragment key={`${index}-${line.slice(0, 16)}`}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ))
}
