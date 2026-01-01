import { createFileRoute, Link } from "@tanstack/react-router"
import { Footer } from "@/components/footer"

export const Route = createFileRoute("/terms")({
	head: () => ({
		meta: [
			{
				title: "Terms of Service - WODsmith",
			},
			{
				name: "description",
				content: "WODsmith Terms of Service",
			},
		],
	}),
	component: TermsPage,
})

function TermsPage() {
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
						TERMS OF SERVICE
					</h1>

					<div className="prose prose-lg dark:prose-invert max-w-none font-sans">
						<p className="text-muted-foreground mb-8">
							Last updated: December 31, 2025
						</p>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								1. Acceptance of Terms
							</h2>
							<p>
								By accessing or using WODsmith ("the Service"), you agree to be
								bound by these Terms of Service. If you do not agree to these
								terms, please do not use the Service.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								2. Description of Service
							</h2>
							<p>
								WODsmith provides tools for the functional fitness community,
								including workout tracking, competition management, and related
								services. We reserve the right to modify, suspend, or
								discontinue any aspect of the Service at any time.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								3. User Accounts
							</h2>
							<p>
								You are responsible for maintaining the confidentiality of your
								account credentials and for all activities that occur under your
								account. You must provide accurate information when creating an
								account and promptly update any changes.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								4. User Conduct
							</h2>
							<p>You agree not to:</p>
							<ul className="list-disc pl-6 mt-2 space-y-2">
								<li>Use the Service for any unlawful purpose</li>
								<li>Interfere with the proper functioning of the Service</li>
								<li>Attempt to gain unauthorized access to other accounts</li>
								<li>Upload malicious content or spam</li>
								<li>Impersonate others or provide false information</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								5. Intellectual Property
							</h2>
							<p>
								All content and materials available through the Service,
								including but not limited to text, graphics, logos, and
								software, are the property of WODsmith or its licensors and are
								protected by intellectual property laws.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								6. User Content
							</h2>
							<p>
								You retain ownership of content you create and upload to the
								Service. By uploading content, you grant WODsmith a
								non-exclusive, worldwide license to use, display, and distribute
								your content in connection with the Service.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								7. Disclaimer of Warranties
							</h2>
							<p>
								THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND,
								EITHER EXPRESS OR IMPLIED. WODSMITH DOES NOT WARRANT THAT THE
								SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								8. Limitation of Liability
							</h2>
							<p>
								TO THE MAXIMUM EXTENT PERMITTED BY LAW, WODSMITH SHALL NOT BE
								LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
								PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								9. Fitness Disclaimer
							</h2>
							<p>
								WODsmith provides workout tracking and information for general
								fitness purposes only. The Service is not a substitute for
								professional medical advice. Consult with a healthcare provider
								before beginning any fitness program. You assume all risks
								associated with your physical activities.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								10. Changes to Terms
							</h2>
							<p>
								We may update these Terms of Service from time to time. We will
								notify you of any material changes by posting the new terms on
								this page. Your continued use of the Service after changes
								constitutes acceptance of the updated terms.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="font-mono text-2xl font-bold mb-4">
								11. Contact Us
							</h2>
							<p>
								If you have any questions about these Terms of Service, please
								contact us at{" "}
								<a
									href="mailto:support@wodsmith.com"
									className="text-orange hover:underline"
								>
									support@wodsmith.com
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
