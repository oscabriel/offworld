import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms-of-service")({
	component: TermsOfServiceComponent,
});

function TermsOfServiceComponent() {
	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-3xl flex-1 space-y-13 px-5 pb-21">
				<div className="space-y-5">
					<h1 className="font-serif text-5xl tracking-tight md:text-6xl">Terms of Service</h1>
					<p className="text-muted-foreground text-sm">Last updated: January 2025</p>
				</div>

				<div className="prose prose-neutral dark:prose-invert prose-headings:font-serif prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-primary max-w-none font-mono">
					<p>
						These Terms of Service ("Terms") govern your access to and use of the Offworld website
						at offworld.sh and command-line interface tool (collectively, the "Service") operated by
						Oscar Gabriel ("we", "us", or "our"). By accessing or using the Service, you agree to be
						bound by these Terms.
					</p>

					<h2 className="font-serif">1. Description of Service</h2>
					<p>
						Offworld is a tool for generating and sharing AI agent{" "}
						<a
							href="https://agentskills.io/specification#references/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							reference files
						</a>{" "}
						for open source software libraries. The Service consists of a command-line interface
						(CLI) that runs locally on your machine and a web platform for discovering and sharing
						reference files. The CLI is released under the MIT License. The web service is provided
						free of charge.
					</p>

					<h2 className="font-serif">2. Account Registration</h2>
					<p>
						Certain features of the Service, including pushing references to the platform, require
						you to authenticate using your GitHub account. By authenticating, you represent that you
						have a valid GitHub account in good standing and agree to comply with GitHub's terms of
						service. You are responsible for maintaining the security of your account credentials.
					</p>

					<h2 className="font-serif">3. User Content</h2>

					<h3 className="font-serif">3.1 Ownership</h3>
					<p>
						You retain ownership of any references or other content you create and publish through
						the Service ("User Content"). By pushing User Content to the platform, you grant us a
						worldwide, non-exclusive, royalty-free license to host, store, display, reproduce, and
						distribute your User Content solely for the purpose of operating and providing the
						Service.
					</p>

					<h3 className="font-serif">3.2 Public Nature</h3>
					<p>
						All references pushed to the platform are publicly visible. Do not push content that you
						wish to keep private or confidential.
					</p>

					<h3 className="font-serif">3.3 Content Requirements</h3>
					<p>
						References may only be pushed for public GitHub repositories with at least 5 stars. Each
						push must be associated with a valid commit SHA that exists in the repository.
					</p>

					<h2 className="font-serif">4. Acceptable Use</h2>
					<p>You agree not to:</p>
					<ul>
						<li>
							Push content that is malicious, misleading, defamatory, or infringes on the
							intellectual property rights of others
						</li>
						<li>Attempt to circumvent rate limits, access controls, or other security measures</li>
						<li>Use the Service for any illegal purpose or in violation of applicable laws</li>
						<li>Impersonate others or misrepresent your affiliation with any person or entity</li>
						<li>
							Interfere with or disrupt the Service or servers or networks connected to the Service
						</li>
						<li>
							Use automated means to access the Service in a manner that exceeds reasonable use or
							places undue burden on the infrastructure
						</li>
					</ul>

					<h2 className="font-serif">5. Rate Limits</h2>
					<p>
						To ensure fair access for all users, the Service enforces rate limits including a
						maximum of 20 pushes per user per day. We reserve the right to modify these limits at
						any time.
					</p>

					<h2 className="font-serif">6. Moderation and Termination</h2>
					<p>
						We reserve the right to remove any User Content and suspend or terminate your access to
						the Service at any time, with or without cause or notice, including for violations of
						these Terms. We may also verify references and mark them as verified at our discretion.
					</p>

					<h2 className="font-serif">7. Intellectual Property</h2>
					<p>
						The Service and its original content (excluding User Content), features, and
						functionality are owned by us and are protected by copyright, trademark, and other
						intellectual property laws. The Offworld CLI is released under the MIT License, the
						terms of which are available in the project repository.
					</p>

					<h2 className="font-serif">8. Third-Party Services</h2>
					<p>
						The Service integrates with third-party services including GitHub, WorkOS, Convex, and
						Cloudflare. Your use of these services is subject to their respective terms and privacy
						policies. We are not responsible for the practices of these third parties.
					</p>

					<h2 className="font-serif">9. Disclaimer of Warranties</h2>
					<p>
						THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
						EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
						MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
						WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
					</p>
					<p>
						References generated by AI may contain errors, inaccuracies, or outdated information.
						You are responsible for verifying any information before relying on it in production
						environments.
					</p>

					<h2 className="font-serif">10. Limitation of Liability</h2>
					<p>
						TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT,
						INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
						REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL,
						OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO
						ACCESS OR USE THE SERVICE.
					</p>

					<h2 className="font-serif">11. Indemnification</h2>
					<p>
						You agree to indemnify and hold us harmless from any claims, damages, losses, or
						expenses (including reasonable attorneys' fees) arising from your use of the Service,
						your User Content, or your violation of these Terms.
					</p>

					<h2 className="font-serif">12. Changes to Terms</h2>
					<p>
						We may modify these Terms at any time. We will provide notice of material changes by
						posting the updated Terms on this page and updating the "Last updated" date. Your
						continued use of the Service after changes become effective constitutes acceptance of
						the revised Terms.
					</p>

					<h2 className="font-serif">13. Governing Law</h2>
					<p>
						These Terms shall be governed by and construed in accordance with the laws of the United
						States, without regard to conflict of law principles.
					</p>

					<h2 className="font-serif">14. Severability</h2>
					<p>
						If any provision of these Terms is found to be unenforceable, the remaining provisions
						will continue in full force and effect.
					</p>

					<h2 className="font-serif">15. Contact</h2>
					<p>
						If you have questions about these Terms, please contact us at{" "}
						<a href="mailto:hey@oscargabriel.dev">hey@oscargabriel.dev</a>.
					</p>
				</div>
			</div>
		</div>
	);
}
