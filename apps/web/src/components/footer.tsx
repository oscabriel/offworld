import { Link } from "@tanstack/react-router";

export function Footer() {
	return (
		<div className="relative border-primary/10 border-y bg-background/30 py-16 backdrop-blur-sm">
			<div className="container relative mx-auto flex items-end justify-between gap-16 px-4">
				{/* Left - Brand */}
				<div className="flex shrink-0 items-end">
					<Link
						to="/"
						className="-mb-2 block font-serif text-6xl text-primary leading-none transition-colors hover:text-foreground"
					>
						offworld.sh
					</Link>
				</div>

				{/* Middle - Links */}
				<div className="-translate-x-1/2 absolute left-1/2 flex items-end gap-20">
					<div className="space-y-2">
						<h3 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Navigate
						</h3>
						<div className="flex flex-col gap-1">
							<Link
								to="/explore"
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								Explore
							</Link>
							<Link
								to="/sign-in"
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								Login
							</Link>
						</div>
					</div>

					<div className="space-y-2">
						<h3 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Learn
						</h3>
						<div className="flex flex-col gap-1">
							<a
								href="https://docs.offworld.sh"
								target="_blank"
								rel="noopener noreferrer"
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								Docs
							</a>
							<Link
								to="/about"
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								About
							</Link>
						</div>
					</div>

					<div className="space-y-2">
						<h3 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Connect
						</h3>
						<div className="flex flex-col gap-1">
							<a
								href="https://twitter.com/oscabriel"
								target="_blank"
								rel="noopener noreferrer"
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								Twitter
							</a>
							<Link
								to="/$owner/$repo"
								params={{ owner: "oscabriel", repo: "offworld" }}
								target="_blank"
								rel="noopener noreferrer"
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								GitHub
							</Link>
						</div>
					</div>
				</div>

				{/* Right - Tagline & Copyright */}
				<div className="flex shrink-0 flex-col items-end justify-between gap-4 self-stretch text-right">
					<p className="font-serif text-2xl text-primary italic">
						“Explore distant code.”
					</p>
					<a
						href="https://oscargabriel.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						© {new Date().getFullYear()} Oscar Gabriel
					</a>
				</div>
			</div>
		</div>
	);
}
