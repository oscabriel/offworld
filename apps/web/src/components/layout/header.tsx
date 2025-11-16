import { Link } from "@tanstack/react-router";

export default function Header() {
	const links = [{ to: "/explore", label: "Explore" }];

	return (
		<div className="pointer-events-none absolute top-0 right-0 left-0 z-50 bg-transparent">
			<div className="container mx-auto flex max-w-7xl flex-row items-center justify-between px-4 py-2 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<Link to="/" className="pointer-events-auto flex items-center gap-2">
					<img src="/favicon.svg" alt="Home" className="h-10 w-10" />
				</Link>
				<nav className="pointer-events-auto flex gap-6 font-serif text-lg">
					{links.map(({ to, label }) => {
						return (
							<Link
								key={to}
								to={to}
								className="cursor-pointer transition-opacity hover:opacity-70"
							>
								{label}
							</Link>
						);
					})}
				</nav>
			</div>
		</div>
	);
}
