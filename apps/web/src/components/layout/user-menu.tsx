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
				className="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
			>
				<span className="font-serif text-base font-semibold">Sign In</span>
			</Link>
		);
	}

	const firstName = displayFirstName ?? "User";

	return (
		<a
			href="/profile"
			className="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium whitespace-nowrap shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
		>
			<span className="font-serif text-base font-semibold">{firstName}</span>
		</a>
	);
}
