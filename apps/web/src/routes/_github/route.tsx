import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_github")({
	component: GitHubLayout,
});

function GitHubLayout() {
	return (
		<div className="flex flex-1 flex-col">
			<Outlet />
		</div>
	);
}
