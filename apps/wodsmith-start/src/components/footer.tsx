import { Heart } from "lucide-react"
import { DarkModeToggle } from "./nav/dark-mode-toggle"

export function Footer() {
	return (
		<footer className="bg-black text-white py-16">
			<div className="container mx-auto px-4">
				<div className="grid md:grid-cols-4 gap-8 mb-12">
					<div>
						<div className="font-mono text-2xl text-white mb-4">
							<span className="text-orange">WOD</span>smith
						</div>
						<p className="font-sans text-white/80 mb-6">
							The brutally simple workout tracker that helps you crush your
							fitness goals.
						</p>
						<DarkModeToggle />
					</div>
				</div>

				<div className="border-t border-white/20 pt-8">
					<div className="flex flex-col md:flex-row justify-between items-center">
						<p className="font-sans text-white/80 mb-4 md:mb-0">
							Made with <Heart className="inline text-primary size-4" /> by
							athletes, for athletes
						</p>
						<p className="font-sans text-white/80">
							© 2025 WODsmith. All rights reserved.
						</p>
					</div>
				</div>
			</div>
		</footer>
	)
}

export default Footer
