import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export function Footer() {
	const { data: user } = useQuery(convexQuery(api.auth.getCurrentUserSafe, {}));
	return (
		<div className="border-primary/10 bg-background/30 relative border-y py-21 backdrop-blur-sm">
			<div className="relative container mx-auto flex max-w-7xl flex-col items-center justify-between gap-21 px-5 lg:max-w-5xl lg:flex-row lg:items-end xl:max-w-6xl 2xl:max-w-7xl">
				<div className="flex shrink-0 items-end">
					<Link
						to="/"
						className="text-primary hover:text-foreground -mb-2 block font-serif text-7xl leading-none transition-colors lg:text-6xl xl:text-7xl"
					>
						offworld.sh
					</Link>
				</div>

				<div className="flex flex-row items-center gap-21 lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:items-end">
					<div className="space-y-2 text-center lg:text-left">
						<h3 className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
							Navigate
						</h3>
						<div className="flex flex-col gap-1">
							<Link
								to="/explore"
								className="text-foreground hover:text-primary font-mono text-sm transition-colors"
							>
								Explore
							</Link>
							<Link
								to={user ? "/profile" : "/sign-in"}
								className="text-foreground hover:text-primary font-mono text-sm transition-colors"
							>
								{user ? "Profile" : "Login"}
							</Link>
						</div>
					</div>

					<div className="space-y-2 text-center lg:text-left">
						<h3 className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
							Learn
						</h3>
						<div className="flex flex-col gap-1">
							<a
								href="https://docs.offworld.sh"
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-primary font-mono text-sm transition-colors"
							>
								Docs
							</a>
							<Link
								to="/$owner/$repo"
								params={{ owner: "oscabriel", repo: "offworld" }}
								className="text-foreground hover:text-primary font-mono text-sm transition-colors"
							>
								About
							</Link>
						</div>
					</div>

					<div className="space-y-2 text-center lg:text-left">
						<h3 className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
							Connect
						</h3>
						<div className="flex flex-col gap-1">
							<a
								href="https://twitter.com/oscabriel"
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-primary font-mono text-sm transition-colors"
							>
								Twitter
							</a>
							<a
								href="https://github.com/oscabriel/offworld"
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-primary font-mono text-sm transition-colors"
							>
								GitHub
							</a>
						</div>
					</div>
				</div>

				<div className="flex shrink-0 flex-col items-center justify-between gap-5 self-stretch text-center lg:items-end lg:text-right">
					<p className="text-primary font-serif text-2xl italic">"Explore distant worlds."</p>
					<a
						href="https://oscargabriel.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="text-muted-foreground hover:text-foreground font-mono text-sm transition-colors"
					>
						© {new Date().getFullYear()} Oscar Gabriel
					</a>
				</div>
			</div>
		</div>
	);
}
