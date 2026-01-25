import { Link } from "@tanstack/react-router";
import UserMenu from "@/components/layout/user-menu";

export default function Header() {
	return (
		<div className="pointer-events-none absolute top-0 right-0 left-0 z-50 bg-transparent">
			<div className="container mx-auto flex max-w-7xl flex-row items-center justify-between px-5 py-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<Link to="/" className="pointer-events-auto flex items-center gap-2">
					<img
						src="/logotype.svg"
						alt="Offworld"
						className="h-8 transition-transform hover:scale-105"
					/>
				</Link>
				<nav className="pointer-events-auto flex items-center gap-8">
					<Link
						to="/cli"
						className="text-primary hover:text-primary/40 font-mono text-base transition-colors"
					>
						CLI
					</Link>
					<Link
						to="/explore"
						className="text-primary hover:text-primary/40 font-mono text-base transition-colors"
					>
						Explore
					</Link>
					<UserMenu />
				</nav>
			</div>
		</div>
	);
}
