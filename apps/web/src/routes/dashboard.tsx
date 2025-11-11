import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
	useQuery,
} from "convex/react";
import { useState } from "react";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(false);
	const privateData = useQuery(api.privateData.get);

	return (
		<div className="container mx-auto max-w-4xl px-4 py-24">
			<Authenticated>
				<div className="space-y-8">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight">
							Dashboard
						</h1>
						<p className="text-muted-foreground mt-2">
							Welcome to your dashboard
						</p>
					</div>

					<div className="rounded-lg border p-6">
						<h2 className="mb-2 text-lg font-medium">Private Data</h2>
						<p className="text-muted-foreground">
							{privateData?.message || "Loading..."}
						</p>
					</div>

					<UserMenu />
				</div>
			</Authenticated>
			<Unauthenticated>
				<div className="mx-auto max-w-md">
					{showSignIn ? (
						<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
					) : (
						<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
					)}
				</div>
			</Unauthenticated>
			<AuthLoading>
				<div className="flex min-h-screen items-center justify-center">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</AuthLoading>
		</div>
	);
}
