import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_github")({
	component: RepoLayout,
});

function RepoLayout() {
	return <Outlet />;
}
