import { Link, useRouteContext } from "@tanstack/react-router";

export default function Header() {
	const { userId } = useRouteContext({ from: "__root__" });

	const links = [
		{ to: "/", label: "Home" },
		{ to: "/dashboard", label: "Dashboard" },
		...(userId ? [{ to: "/todos", label: "Todos" } as const] : []),
	];

	return (
		<div className="absolute top-0 right-0 left-0 z-50 bg-transparent pointer-events-none">
			<div className="flex flex-row items-center justify-between px-4 py-2">
				<Link to="/" className="flex items-center gap-2 pointer-events-auto">
					<img src="/favicon.svg" alt="Home" className="h-10 w-10" />
				</Link>
				<nav className="flex gap-6 text-sm pointer-events-auto">
					{links.map(({ to, label }) => {
						return (
							<Link
								key={to}
								to={to}
								className="hover:opacity-70 transition-opacity cursor-pointer"
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
