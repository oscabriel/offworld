import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ReferenceTable } from "@/components/admin/analysis-table";
import { UserTable } from "@/components/admin/user-table";

export const Route = createFileRoute("/admin")({
	component: AdminPage,
	beforeLoad: async ({ context }) => {
		const isAdmin = await context.queryClient.fetchQuery(convexQuery(api.auth.isAdmin, {}));
		if (!isAdmin) {
			throw redirect({ to: "/" });
		}
	},
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(convexQuery(api.admin.listAllReferences, {})),
			context.queryClient.ensureQueryData(convexQuery(api.admin.listAllUsers, {})),
		]);
	},
});

function AdminPage() {
	const [activeTab, setActiveTab] = useState<"references" | "users">("references");

	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-5 pb-21 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-8">
					<h1 className="font-serif text-5xl tracking-tight">Admin</h1>

					<div className="border-primary/10 flex gap-5 border-b">
						<button
							type="button"
							onClick={() => setActiveTab("references")}
							className={`px-5 py-2 font-mono text-sm ${
								activeTab === "references"
									? "border-primary text-primary border-b-2"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							References
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("users")}
							className={`px-5 py-2 font-mono text-sm ${
								activeTab === "users"
									? "border-primary text-primary border-b-2"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Users
						</button>
					</div>

					{activeTab === "references" && <ReferenceTable />}
					{activeTab === "users" && <UserTable />}
				</div>
			</div>
		</div>
	);
}
