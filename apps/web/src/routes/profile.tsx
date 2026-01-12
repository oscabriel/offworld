import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/profile")({
	component: ProfileComponent,
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in", search: { redirect: "/profile" } });
		}
	},
});

function ProfileComponent() {
	const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUserSafe, {}));

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					window.location.href = "/";
				},
			},
		});
	};

	if (!user) {
		return null;
	}

	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="w-full max-w-md space-y-8">
				<h1 className="text-center font-normal font-serif text-5xl">Profile</h1>

				<div className="space-y-4 rounded-lg border border-border bg-card p-6">
					<div className="space-y-1">
						<p className="text-muted-foreground text-sm">Name</p>
						<p className="font-serif text-lg">{user.name || "Not set"}</p>
					</div>

					<div className="space-y-1">
						<p className="text-muted-foreground text-sm">Email</p>
						<p className="font-mono text-sm">{user.email}</p>
					</div>
				</div>

				<div className="flex justify-center">
					<Button variant="outline" onClick={handleSignOut}>
						<LogOutIcon className="size-4" />
						<span className="font-mono">Sign Out</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
