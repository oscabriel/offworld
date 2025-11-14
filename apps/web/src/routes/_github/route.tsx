import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_github")({
	component: GithubLayout,
});

function GithubLayout() {
	return (
		<div>
			{/* Shared layout for all GitHub-related routes */}
			{/* Can add breadcrumbs, shared nav, etc. here */}
			<Outlet />
		</div>
	);
}
