import { Link } from "@tanstack/react-router";

export function Footer() {
	return (
		<div className="relative border-primary/10 border-y bg-background/30 py-16 backdrop-blur-sm">
			<div className="container relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-4 lg:max-w-5xl lg:flex-row lg:items-end xl:max-w-6xl 2xl:max-w-7xl">
				{/* Left - Brand */}
				<div className="flex shrink-0 items-end">
					<Link
						to="/"
						className="-mb-2 block font-serif text-7xl text-primary leading-none transition-colors hover:text-foreground lg:text-6xl xl:text-7xl"
					>
						offworld.sh
					</Link>
				</div>

				{/* Middle - Links */}
				<div className="flex flex-row items-center gap-20 lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:items-end">
					<div className="space-y-2 text-center lg:text-left">
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

					<div className="space-y-2 text-center lg:text-left">
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
								to="/$owner/$repo"
								params={{ owner: "oscabriel", repo: "offworld" }}
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								About
							</Link>
						</div>
					</div>

					<div className="space-y-2 text-center lg:text-left">
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
							<a
								href="https://github.com/oscabriel/offworld"
								target="_blank"
								rel="noopener noreferrer"
								className="font-mono text-foreground text-sm transition-colors hover:text-primary"
							>
								GitHub
							</a>
						</div>
					</div>
				</div>

				{/* Right - Tagline & Copyright */}
				<div className="flex shrink-0 flex-col items-center justify-between gap-4 self-stretch text-center lg:items-end lg:text-right">
					<p className="font-serif text-2xl text-primary italic">"Explore distant code."</p>
					<a
						href="https://oscargabriel.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="font-mono text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						© {new Date().getFullYear()} Oscar Gabriel
					</a>
				</div>
			</div>
		</div>
	);
}
