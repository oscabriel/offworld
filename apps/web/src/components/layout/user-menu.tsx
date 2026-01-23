import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

const getFirstName = (user: { name?: string | null; email?: string | null } | null | undefined) => {
	if (!user) {
		return null;
	}
	return user.name?.trim().split(/\s+/)[0] ?? null;
};

export default function UserMenu() {
	const { data: user } = useQuery(convexQuery(api.auth.getCurrentUserSafe, {}));

	const displayFirstName = user ? (getFirstName(user) ?? "User") : null;

	if (!user) {
		return (
			<Link
				to="/sign-in"
				className="bg-primary text-background hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 items-center justify-center gap-2 px-5 py-2 font-mono text-base transition-colors focus-visible:ring-1 focus-visible:outline-none"
			>
				Sign In
			</Link>
		);
	}

	const firstName = displayFirstName ?? "User";

	return (
		<a
			href="/profile"
			className="border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 border px-5 font-mono text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
		>
			{firstName}
		</a>
	);
}
