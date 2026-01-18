"use client"

import { ChevronDown, HelpCircle } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const faqs = [
	{
		question: "How do I migrate from another platform?",
		answer:
			"We offer concierge migration for your first event. Bring your athlete list and division structure, and we'll help you set up. For repeat organizers, we have CSV import tools for athlete data.",
	},
	{
		question: "What does WODsmith cost?",
		answer:
			"WODsmith is free to try with your first event. For ongoing use, we charge a small fee per registered athlete. No monthly subscription, no surprise platform fees. You only pay when athletes register.",
	},
	{
		question: "What kind of support do you offer?",
		answer:
			"Priority support during event windows. We know comp day is high-stakes. You get a direct line to our team, not a ticketing queue. Response time SLAs are tighter when your event is live.",
	},
	{
		question: "Does WODsmith work offline?",
		answer:
			"Score submissions buffer locally when connectivity drops and sync when you're back online. For fully offline venues, we're working on a more robust offline mode. Talk to us about your specific needs.",
	},
	{
		question: "How do digital appeals work?",
		answer:
			"Coming soon: athletes submit appeals through the app with evidence (photos, videos). Organizers review and respond with a decision, rule reference, and explanation. Every appeal is tracked and documented.",
	},
	{
		question: "How do push notifications work?",
		answer:
			"Coming soon: athletes opt in to receive alerts before their heats (60, 30, and 10 minutes). They also get notified if their lane or heat time changes. No more paper schedules taped to walls.",
	},
]

interface FAQItemProps {
	question: string
	answer: string
	isOpen: boolean
	onToggle: () => void
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
	return (
		<div className="border-b border-border">
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between py-6 text-left"
			>
				<span className="font-medium">{question}</span>
				<ChevronDown
					className={cn(
						"h-5 w-5 shrink-0 text-muted-foreground transition-transform",
						isOpen && "rotate-180",
					)}
				/>
			</button>
			<div
				className={cn(
					"grid transition-all",
					isOpen ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]",
				)}
			>
				<div className="overflow-hidden">
					<p className="text-muted-foreground">{answer}</p>
				</div>
			</div>
		</div>
	)
}

export function FAQSection() {
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	return (
		<section id="faq" className="bg-background py-20">
			<div className="container mx-auto px-4">
				<div className="mx-auto max-w-3xl">
					<div className="mb-12 text-center">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2">
							<HelpCircle className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium text-sm text-muted-foreground">
								FAQ
							</span>
						</div>

						<h2 className="mb-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
							Frequently asked questions
						</h2>

						<p className="text-lg text-muted-foreground">
							Everything organizers ask before signing up.
						</p>
					</div>

					<div className="rounded-xl border border-border bg-card">
						<div className="px-6">
							{faqs.map((faq, index) => (
								<FAQItem
									key={faq.question}
									question={faq.question}
									answer={faq.answer}
									isOpen={openIndex === index}
									onToggle={() =>
										setOpenIndex(openIndex === index ? null : index)
									}
								/>
							))}
						</div>
					</div>

					<p className="mt-8 text-center text-muted-foreground">
						Have a question not covered here?{" "}
						<a
							href="mailto:hello@wodsmith.com"
							className="font-medium text-primary hover:underline"
						>
							Reach out directly
						</a>
					</p>
				</div>
			</div>
		</section>
	)
}
