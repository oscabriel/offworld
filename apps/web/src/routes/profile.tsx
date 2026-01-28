import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/profile")({
	component: ProfileComponent,
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in", search: { redirect: "/profile" } });
		}
	},
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(convexQuery(api.auth.getCurrentUserSafe, {})),
			context.queryClient.ensureQueryData(convexQuery(api.references.listByCurrentUser, {})),
		]);
	},
});

function formatRelativeDate(isoString: string) {
	const date = new Date(isoString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "today";
	if (diffDays === 1) return "yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;
	if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
	if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
	return `${Math.floor(diffDays / 365)}y ago`;
}

function formatFullDate(isoString: string) {
	return new Date(isoString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function ProfileComponent() {
	const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUserSafe, {}));
	const { data: pushedReferences } = useSuspenseQuery(
		convexQuery(api.references.listByCurrentUser, {}),
	);

	const { signOut } = useAuth();

	const handleSignOut = async () => {
		await signOut();
		window.location.href = "/";
	};

	if (!user) {
		return null;
	}

	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 space-y-13 px-5 pb-21 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-5">
					<h1 className="font-serif text-6xl tracking-tight md:text-7xl">Profile</h1>
				</div>

				<div className="border-border bg-card flex items-start justify-between gap-5 border p-5">
					<div className="space-y-5">
						<div className="space-y-1">
							<p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
								Name
							</p>
							<p className="font-serif text-lg">{user.name || "Not set"}</p>
						</div>

						<div className="space-y-1">
							<p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
								Email
							</p>
							<p className="font-mono text-sm">{user.email}</p>
						</div>
					</div>

					<Button className="shrink-0 py-5" size="lg" onClick={handleSignOut}>
						<LogOutIcon className="size-5" />
						<span className="text-background font-mono text-base">Sign Out</span>
					</Button>
				</div>

				<div className="space-y-5">
					<h2 className="font-serif text-3xl tracking-tight">Pushed Reference Files</h2>

					{pushedReferences.length === 0 ? (
						<div className="bg-background border-primary/10 border p-8 text-center">
							<p className="text-muted-foreground font-mono text-base">
								You haven't pushed any{" "}
								<a
									href="https://agentskills.io/specification#references/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									reference files
								</a>{" "}
								yet.
							</p>
							<p className="text-muted-foreground mt-2 font-mono text-sm">
								Use <code className="text-primary">ow push &lt;repo&gt;</code> to share one.
							</p>
						</div>
					) : (
						<div className="bg-background border-primary/10 overflow-x-auto border">
							<table className="w-full">
								<thead>
									<tr className="border-primary/10 border-b">
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs tracking-widest uppercase">
											Repository
										</th>
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs tracking-widest uppercase">
											Reference
										</th>
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs tracking-widest uppercase">
											Pulls
										</th>
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs tracking-widest uppercase">
											Pushed
										</th>
									</tr>
								</thead>
								<tbody>
									<TooltipProvider>
										{pushedReferences.map((reference) => (
											<tr
												key={`${reference.fullName}-${reference.referenceName}`}
												className="border-primary/5 border-b last:border-b-0"
											>
												<td className="px-5 py-4">
													<Link
														to="/$owner/$repo"
														params={{ owner: reference.owner, repo: reference.name }}
														className="text-primary font-mono text-sm hover:underline"
													>
														{reference.fullName}
													</Link>
												</td>
												<td className="text-muted-foreground px-5 py-4 font-mono text-sm">
													{reference.referenceName}
												</td>
												<td className="text-muted-foreground px-5 py-4 font-mono text-sm">
													{reference.pullCount}
												</td>
												<td className="text-muted-foreground px-5 py-4 font-mono text-sm">
													<Tooltip>
														<TooltipTrigger>
															{formatRelativeDate(reference.generatedAt)}
														</TooltipTrigger>
														<TooltipContent>{formatFullDate(reference.generatedAt)}</TooltipContent>
													</Tooltip>
												</td>
											</tr>
										))}
									</TooltipProvider>
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
