import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
	component: PrivacyPolicyComponent,
});

function PrivacyPolicyComponent() {
	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-3xl flex-1 space-y-13 px-5 pb-21">
				<div className="space-y-5">
					<h1 className="font-serif text-5xl tracking-tight md:text-6xl">Privacy Policy</h1>
					<p className="text-muted-foreground text-sm">Last updated: January 2025</p>
				</div>

				<div className="prose prose-neutral dark:prose-invert prose-headings:font-serif prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-primary max-w-none font-mono">
					<p>
						This Privacy Policy describes how Offworld ("we", "us", or "our") collects, uses, and
						shares information when you use our website at offworld.sh and our command-line
						interface tool (collectively, the "Service").
					</p>

					<h2 className="font-serif">Information We Collect</h2>

					<h3 className="font-serif">Account Information</h3>
					<p>
						When you sign in using GitHub OAuth, we receive and store your email address, display
						name, and profile picture from your GitHub account. This information is provided to us
						through WorkOS, our authentication provider.
					</p>

					<h3 className="font-serif">Content You Publish</h3>
					<p>
						When you push a{" "}
						<a
							href="https://agentskills.io/specification#references/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							reference file
						</a>{" "}
						to our platform, we store the reference content, associated repository metadata (name,
						owner, description, star count), and the commit SHA. All pushed reference files are
						publicly visible and attributed to your account.
					</p>

					<h3 className="font-serif">Usage Information</h3>
					<p>
						We collect basic usage data including pull counts for references and push logs for rate
						limiting purposes. We do not use third-party analytics services.
					</p>

					<h2 className="font-serif">Information We Do Not Collect</h2>

					<h3 className="font-serif">Your Source Code</h3>
					<p>
						The Offworld CLI generates references locally on your machine using AI. Your source code
						is never transmitted to our servers. Only the generated reference content is uploaded
						when you explicitly choose to push it.
					</p>

					<h3 className="font-serif">Local CLI Data</h3>
					<p>
						The CLI stores configuration, authentication tokens, and cloned repositories locally on
						your machine. This data remains on your device and is not transmitted to us except when
						you initiate specific actions like pushing a reference.
					</p>

					<h2 className="font-serif">How We Use Your Information</h2>
					<p>We use the information we collect to:</p>
					<ul>
						<li>Provide, maintain, and improve the Service</li>
						<li>Authenticate your identity and manage your account</li>
						<li>Display your published references and attribute them to you</li>
						<li>Enforce rate limits and prevent abuse</li>
						<li>Respond to your requests and communications</li>
					</ul>

					<h2 className="font-serif">How We Share Your Information</h2>
					<p>
						We do not sell your personal information. We share information with third-party service
						providers who assist us in operating the Service:
					</p>
					<ul>
						<li>
							<strong>WorkOS</strong> — Authentication and identity management
						</li>
						<li>
							<strong>Convex</strong> — Database hosting and backend infrastructure
						</li>
						<li>
							<strong>Cloudflare</strong> — Web hosting, content delivery, and security
						</li>
						<li>
							<strong>GitHub</strong> — OAuth authentication and repository validation
						</li>
					</ul>
					<p>
						These providers are contractually obligated to protect your information and may only use
						it to provide services to us.
					</p>

					<h2 className="font-serif">Data Retention</h2>
					<p>
						We retain your account information for as long as your account is active. Published
						references are retained indefinitely unless removed by you or by us for policy
						violations. You may request deletion of your account and associated data at any time.
					</p>

					<h2 className="font-serif">Data Security</h2>
					<p>
						We implement appropriate technical and organizational measures to protect your
						information. Authentication tokens stored by the CLI are saved with restrictive file
						permissions (0600). However, no method of transmission or storage is completely secure,
						and we cannot guarantee absolute security.
					</p>

					<h2 className="font-serif">Your Rights and Choices</h2>
					<p>
						Depending on your location, you may have certain rights regarding your personal
						information, including the right to access, correct, delete, or export your data. To
						exercise these rights, please contact us at the email address below.
					</p>

					<h2 className="font-serif">International Data Transfers</h2>
					<p>
						Your information may be transferred to and processed in countries other than your own.
						Our service providers maintain servers in various locations globally. By using the
						Service, you consent to such transfers.
					</p>

					<h2 className="font-serif">Children's Privacy</h2>
					<p>
						The Service is not directed to children under 13. We do not knowingly collect personal
						information from children under 13. If we learn that we have collected such information,
						we will take steps to delete it.
					</p>

					<h2 className="font-serif">Changes to This Policy</h2>
					<p>
						We may update this Privacy Policy from time to time. We will notify you of any changes
						by posting the new policy on this page and updating the "Last updated" date. Your
						continued use of the Service after changes become effective constitutes acceptance of
						the revised policy.
					</p>

					<h2 className="font-serif">Contact Us</h2>
					<p>
						If you have questions about this Privacy Policy or wish to exercise your data rights,
						please contact us at <a href="mailto:hey@oscargabriel.dev">hey@oscargabriel.dev</a>.
					</p>
				</div>
			</div>
		</div>
	);
}
