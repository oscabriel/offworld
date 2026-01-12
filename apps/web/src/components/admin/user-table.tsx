import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

function formatDate(isoString: string): string {
	return new Date(isoString).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function UserTable() {
	const { data: users } = useSuspenseQuery(convexQuery(api.admin.listAllUsers, {}));

	if (!users) return null;

	return (
		<Card className="border border-primary/10 p-0 shadow-none">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-primary/10 border-b">
							<th className="px-4 py-3 text-left font-mono text-muted-foreground text-xs">User</th>
							<th className="px-4 py-3 text-left font-mono text-muted-foreground text-xs">Email</th>
							<th className="px-4 py-3 text-left font-mono text-muted-foreground text-xs">
								Joined
							</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => (
							<tr key={user._id} className="border-primary/5 border-b last:border-0">
								<td className="px-4 py-3">
									<div className="flex items-center gap-3">
										{user.image && (
											<img
												src={user.image}
												alt={user.name ?? "User"}
												className="h-8 w-8 rounded-full"
											/>
										)}
										<span className="font-serif">{user.name ?? "—"}</span>
									</div>
								</td>
								<td className="px-4 py-3 font-mono text-muted-foreground text-sm">{user.email}</td>
								<td className="px-4 py-3 font-mono text-muted-foreground text-sm">
									{formatDate(user.createdAt)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Card>
	);
}
