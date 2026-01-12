import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/sign-in")({
	component: SignInComponent,
	validateSearch: searchSchema,
});

function SignInComponent() {
	const { redirect } = Route.useSearch();

	const handleGitHubSignIn = async () => {
		await authClient.signIn.social({
			provider: "github",
			callbackURL: redirect || "/",
		});
	};

	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="w-full max-w-md">
				<h1 className="mb-8 text-center font-normal font-serif text-5xl">Welcome to Offworld</h1>

				<div className="flex justify-center">
					<Button onClick={handleGitHubSignIn} className="w-xs" size="lg">
						<svg
							className="mr-2 h-5 w-5"
							fill="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								fillRule="evenodd"
								d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
								clipRule="evenodd"
							/>
						</svg>
						<span className="font-mono text-background text-base">Sign in with GitHub</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
