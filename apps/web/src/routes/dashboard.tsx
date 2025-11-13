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
				<div className="space-y-12">
					<div>
						<h1 className="font-normal font-serif text-5xl tracking-tight">
							Dashboard
						</h1>
						<p className="mt-3 font-mono font-medium text-lg text-muted-foreground">
							Welcome to your dashboard
						</p>
					</div>

					<div className="rounded-lg border-2 border-primary/10 p-8">
						<h2 className="mb-3 font-normal font-serif text-2xl">
							Private Data
						</h2>
						<p className="font-mono font-medium text-base text-muted-foreground">
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
