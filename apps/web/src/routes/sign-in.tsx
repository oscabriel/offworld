import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/sign-in")({
	component: SignInComponent,
	validateSearch: searchSchema,
	beforeLoad: async ({ search }) => {
		const { user } = await getAuth();
		if (user) {
			throw redirect({ to: search.redirect || "/" });
		}
	},
	loaderDeps: ({ search }) => ({ redirectPath: search.redirect }),
	loader: async ({ deps }) => {
		const signInUrl = await getSignInUrl({
			data: deps.redirectPath ? { returnPathname: deps.redirectPath } : undefined,
		});
		return { signInUrl };
	},
});

function SignInComponent() {
	const { signInUrl } = Route.useLoaderData();

	return (
		<div className="flex min-h-full flex-1 items-center justify-center p-8">
			<div className="w-full max-w-md">
				<h1 className="mb-8 text-center font-serif text-5xl font-normal">Welcome to Offworld</h1>

				<div className="flex justify-center">
					<a href={signInUrl}>
						<Button className="w-xs" size="lg">
							<span className="text-background font-mono text-base">Sign in</span>
						</Button>
					</a>
				</div>
			</div>
		</div>
	);
}
