import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/device/$code" as "/")({
	component: DeviceAuthComponent,
	beforeLoad: async ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login" });
		}
	},
});

function DeviceAuthComponent() {
	const { code } = Route.useParams() as { code: string };
	const [status, setStatus] = useState<"loading" | "ready" | "done" | "error">("loading");
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<"approved" | "denied" | null>(null);

	useEffect(() => {
		async function verify() {
			const res = await authClient.device({ query: { user_code: code } });
			if (res.error) {
				setError(res.error.error_description ?? "Invalid code");
				setStatus("error");
			} else {
				setStatus("ready");
			}
		}
		verify();
	}, [code]);

	async function handleApprove() {
		setStatus("loading");
		const { error: approveError } = await authClient.device.approve({ userCode: code });
		if (approveError) {
			setError(approveError.error_description ?? "Failed to approve");
			setStatus("error");
		} else {
			setResult("approved");
			setStatus("done");
		}
	}

	async function handleDeny() {
		setStatus("loading");
		const { error: denyError } = await authClient.device.deny({ userCode: code });
		if (denyError) {
			setError(denyError.error_description ?? "Failed to deny");
			setStatus("error");
		} else {
			setResult("denied");
			setStatus("done");
		}
	}

	if (status === "loading") {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<p className="text-muted-foreground">Verifying...</p>
			</div>
		);
	}

	if (status === "error") {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<div className="text-center">
					<h1 className="font-serif text-2xl font-bold text-red-500">Error</h1>
					<p className="text-muted-foreground mt-2">{error}</p>
				</div>
			</div>
		);
	}

	if (status === "done") {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<div className="text-center">
					<h1 className="font-serif text-2xl font-bold">
						{result === "approved" ? "Approved" : "Denied"}
					</h1>
					<p className="text-muted-foreground mt-2">
						You can close this window and return to your terminal.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="w-full max-w-md">
				<h1 className="font-serif text-2xl font-bold">Authorize CLI</h1>
				<p className="text-muted-foreground mt-2">
					Code: <code className="font-mono text-lg">{code}</code>
				</p>
				<p className="mt-4">Allow the Offworld CLI to access your account?</p>
				<div className="mt-6 flex gap-4">
					<Button variant="outline" onClick={handleDeny}>
						Deny
					</Button>
					<Button onClick={handleApprove}>Approve</Button>
				</div>
			</div>
		</div>
	);
}
