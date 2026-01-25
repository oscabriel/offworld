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
			context.queryClient.ensureQueryData(convexQuery(api.analyses.listByCurrentUser, {})),
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
	const { data: pushedSkills } = useSuspenseQuery(convexQuery(api.analyses.listByCurrentUser, {}));

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
							<p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Name</p>
							<p className="font-serif text-lg">{user.name || "Not set"}</p>
						</div>

						<div className="space-y-1">
							<p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Email</p>
							<p className="font-mono text-sm">{user.email}</p>
						</div>
					</div>

					<Button className="shrink-0 py-5" size="lg" onClick={handleSignOut}>
						<LogOutIcon className="size-5" />
						<span className="text-background font-mono text-base">Sign Out</span>
					</Button>
				</div>

				<div className="space-y-5">
					<h2 className="font-serif text-3xl tracking-tight">Pushed Skills</h2>

					{pushedSkills.length === 0 ? (
						<div className="bg-background border-primary/10 border p-8 text-center">
							<p className="text-muted-foreground font-mono text-sm">
								You haven't pushed any skills yet.
							</p>
							<p className="text-muted-foreground mt-2 font-mono text-xs">
								Use <code className="text-primary">ow push &lt;repo&gt;</code> to share a skill.
							</p>
						</div>
					) : (
						<div className="bg-background border-primary/10 overflow-x-auto border">
							<table className="w-full">
								<thead>
									<tr className="border-primary/10 border-b">
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs uppercase tracking-widest">
											Repository
										</th>
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs uppercase tracking-widest">
											Skill
										</th>
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs uppercase tracking-widest">
											Pulls
										</th>
										<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs uppercase tracking-widest">
											Pushed
										</th>
									</tr>
								</thead>
								<tbody>
									<TooltipProvider>
										{pushedSkills.map((skill) => (
											<tr key={`${skill.fullName}-${skill.skillName}`} className="border-primary/5 border-b last:border-b-0">
												<td className="px-5 py-4">
													<Link
														to="/$owner/$repo"
														params={{ owner: skill.owner, repo: skill.name }}
														className="text-primary font-mono text-sm hover:underline"
													>
														{skill.fullName}
													</Link>
												</td>
												<td className="text-muted-foreground px-5 py-4 font-mono text-sm">
													{skill.skillName}
												</td>
												<td className="text-muted-foreground px-5 py-4 font-mono text-sm">
													{skill.pullCount}
												</td>
												<td className="text-muted-foreground px-5 py-4 font-mono text-sm">
													<Tooltip>
														<TooltipTrigger>{formatRelativeDate(skill.analyzedAt)}</TooltipTrigger>
														<TooltipContent>{formatFullDate(skill.analyzedAt)}</TooltipContent>
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
