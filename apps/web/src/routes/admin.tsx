import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { AnalysisTable } from "@/components/admin/analysis-table";
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
			context.queryClient.ensureQueryData(convexQuery(api.admin.listAllAnalyses, {})),
			context.queryClient.ensureQueryData(convexQuery(api.admin.listAllUsers, {})),
		]);
	},
});

function AdminPage() {
	const [activeTab, setActiveTab] = useState<"analyses" | "users">("analyses");

	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-5 pb-21 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-8">
					<h1 className="font-serif text-5xl tracking-tight">Admin</h1>

					<div className="border-primary/10 flex gap-5 border-b">
						<button
							type="button"
							onClick={() => setActiveTab("analyses")}
							className={`px-5 py-2 font-mono text-sm ${
								activeTab === "analyses"
									? "border-primary text-primary border-b-2"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Analyses
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

					{activeTab === "analyses" && <AnalysisTable />}
					{activeTab === "users" && <UserTable />}
				</div>
			</div>
		</div>
	);
}
