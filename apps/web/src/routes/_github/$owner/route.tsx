import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_github/$owner")({
	staticData: {
		crumbs: (params) => [
			{ label: params.owner ?? "", to: "/$owner", params: { owner: params.owner ?? "" } },
		],
	},
	component: OwnerLayout,
});

function OwnerLayout() {
	return <Outlet />;
}
