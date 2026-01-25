import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export default function UserMenu() {
	const { data: user } = useQuery(convexQuery(api.auth.getCurrentUserSafe, {}));

	if (!user) {
		return (
			<Link
				to="/sign-in"
				className="text-primary hover:text-primary/40 font-mono text-base transition-colors"
			>
				Login
			</Link>
		);
	}

	return (
		<Link
			to="/profile"
			className="text-primary hover:text-primary/40 font-mono text-base transition-colors"
		>
			Profile
		</Link>
	);
}
