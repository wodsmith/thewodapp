import { createFileRoute, Link } from "@tanstack/react-router"
import { Footer } from "@/components/footer"

export const Route = createFileRoute("/privacy")({
	head: () => ({
		meta: [
			{
				title: "Privacy Policy - WODsmith",
			},
			{
				name: "description",
				content: "WODsmith Privacy Policy",
			},
		],
	}),
	component: PrivacyPage,
})

function PrivacyPage() {
	return (
		<>
			<main className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-16 max-w-4xl">
					<Link
						to="/"
						className="inline-block mb-8 text-orange hover:underline font-mono"
					>
						← Back to Home
					</Link>

					<h1 className="font-mono text-4xl md:text-5xl font-bold mb-8">
						PRIVACY POLICY
					</h1>

					<div className="prose prose-lg dark:prose-invert max-w-none font-sans">
						<p className="text-muted-foreground mb-8">
							Last updated: December 31, 2025
						</p>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								1. Introduction
							</h2>
							<p>
								WODsmith ("we," "our," or "us") respects your privacy and is
								committed to protecting your personal data. This Privacy Policy
								explains how we collect, use, and safeguard your information
								when you use our service.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								2. Information We Collect
							</h2>
							<p>We collect information you provide directly to us:</p>
							<ul className="list-disc pl-6 mt-2 space-y-2">
								<li>
									<strong>Account Information:</strong> Name, email address, and
									password when you create an account
								</li>
								<li>
									<strong>Profile Information:</strong> Optional details like
									profile picture and fitness goals
								</li>
								<li>
									<strong>Workout Data:</strong> Workout logs, performance
									metrics, and training history
								</li>
								<li>
									<strong>Competition Data:</strong> Registration information
									and competition results
								</li>
								<li>
									<strong>Communications:</strong> Messages you send to us or
									other users
								</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								3. Automatically Collected Information
							</h2>
							<p>
								When you use our Service, we automatically collect certain
								information:
							</p>
							<ul className="list-disc pl-6 mt-2 space-y-2">
								<li>Device information (type, operating system, browser)</li>
								<li>Usage data (pages visited, features used, timestamps)</li>
								<li>IP address and approximate location</li>
								<li>Cookies and similar tracking technologies</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								4. How We Use Your Information
							</h2>
							<p>We use your information to:</p>
							<ul className="list-disc pl-6 mt-2 space-y-2">
								<li>Provide, maintain, and improve our Service</li>
								<li>Process your workout data and display your progress</li>
								<li>
									Facilitate competition registrations and display leaderboards
								</li>
								<li>Send service-related communications</li>
								<li>Respond to your requests and provide customer support</li>
								<li>Analyze usage patterns to improve user experience</li>
								<li>Protect against fraud and abuse</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								5. Information Sharing
							</h2>
							<p>We may share your information in the following situations:</p>
							<ul className="list-disc pl-6 mt-2 space-y-2">
								<li>
									<strong>With Your Consent:</strong> When you explicitly agree
									to share information
								</li>
								<li>
									<strong>Competition Organizers:</strong> When you register for
									competitions, organizers receive necessary registration
									details
								</li>
								<li>
									<strong>Service Providers:</strong> With third parties who
									help us operate our Service
								</li>
								<li>
									<strong>Legal Requirements:</strong> When required by law or
									to protect our rights
								</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								6. Data Security
							</h2>
							<p>
								We implement appropriate technical and organizational measures
								to protect your personal data against unauthorized access,
								alteration, disclosure, or destruction. However, no method of
								transmission over the Internet is 100% secure.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								7. Data Retention
							</h2>
							<p>
								We retain your personal data for as long as necessary to provide
								you with our Service and as required by applicable law. You can
								request deletion of your account and associated data at any
								time.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								8. Your Rights
							</h2>
							<p>
								Depending on your location, you may have the following rights:
							</p>
							<ul className="list-disc pl-6 mt-2 space-y-2">
								<li>Access and receive a copy of your personal data</li>
								<li>Correct inaccurate personal data</li>
								<li>Request deletion of your personal data</li>
								<li>Object to or restrict processing of your data</li>
								<li>Data portability</li>
								<li>Withdraw consent at any time</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">9. Cookies</h2>
							<p>
								We use cookies and similar technologies to enhance your
								experience. You can control cookie preferences through your
								browser settings. Disabling cookies may affect the functionality
								of certain features.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								10. Children's Privacy
							</h2>
							<p>
								Our Service is not intended for children under 13. We do not
								knowingly collect personal data from children. If you believe we
								have collected information from a child, please contact us
								immediately.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								11. Changes to This Policy
							</h2>
							<p>
								We may update this Privacy Policy from time to time. We will
								notify you of significant changes by posting the new policy on
								this page and updating the "Last updated" date.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								12. Contact Us
							</h2>
							<p>
								If you have any questions about this Privacy Policy or our data
								practices, please contact us at{" "}
								<a
									href="mailto:privacy@wodsmith.com"
									className="text-orange hover:underline"
								>
									privacy@wodsmith.com
								</a>
								.
							</p>
						</section>
					</div>
				</div>
			</main>
			<Footer />
		</>
	)
}
