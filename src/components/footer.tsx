import { HeartIcon } from "@heroicons/react/24/outline"
import ThemeSwitch from "./theme-switch"

export const Footer = () => {
	return (
		<footer className="bg-primary text-primary-foreground py-16">
			<div className="container mx-auto px-4">
				<div className="grid md:grid-cols-4 gap-8 mb-12">
					<div>
						<div className="font-mono text-2xl text-primary-foreground mb-4">
							<span className="text-orange">WOD</span>smith
						</div>
						<p className="font-sans text-primary-foreground mb-6">
							The brutally simple workout tracker that helps you crush your
							fitness goals.
						</p>
						<ThemeSwitch />
					</div>

					<div>
						<h4 className="font-mono text-lg text-primary-foreground mb-4 uppercase">
							Product
						</h4>
						<ul className="space-y-2 font-sans">
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Features
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Pricing
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Mobile App
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Integrations
								</p>
							</li>
						</ul>
					</div>

					<div>
						<h4 className="font-mono text-lg text-primary-foreground mb-4 uppercase">
							Company
						</h4>
						<ul className="space-y-2 font-sans">
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									About
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Blog
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Careers
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Contact
								</p>
							</li>
						</ul>
					</div>

					<div>
						<h4 className="font-mono text-lg text-primary-foreground mb-4 uppercase">
							Support
						</h4>
						<ul className="space-y-2 font-sans">
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Help Center
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									API Docs
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Privacy
								</p>
							</li>
							<li>
								<p className="text-primary-foreground hover:text-accent transition-colors">
									Terms
								</p>
							</li>
						</ul>
					</div>
				</div>

				<div className="border-t-2 border-primary-foreground pt-8">
					<div className="flex flex-col md:flex-row justify-between items-center">
						<p className="font-sans text-primary-foreground mb-4 md:mb-0">
							Made with <HeartIcon className="inline text-accent size-4" /> by
							athletes, for athletes
						</p>
						<p className="font-sans text-primary-foreground">
							© 2025 WODsmith. All rights reserved.
						</p>
					</div>
				</div>
			</div>
		</footer>
	)
}

export default Footer
