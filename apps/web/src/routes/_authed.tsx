import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context }) => {
		if (!context.userId) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: () => <Outlet />,
});
