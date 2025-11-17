import * as Sentry from "@sentry/tanstackstart-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/test-error")({
	component: TestError,
});

function BrokenComponent({ shouldBreak }: { shouldBreak: boolean }) {
	if (shouldBreak) {
		throw new Error("Component render error - caught by error boundary!");
	}
	return null;
}

function TestError() {
	const [shouldBreak, setShouldBreak] = useState(false);

	const handleManualReport = async () => {
		// Check if Sentry is actually initialized
		const client = Sentry.getClient();
		console.log("Sentry client:", client);
		console.log("Sentry DSN:", client?.getDsn()?.toString());

		const eventId = Sentry.captureException(
			new Error("Manual error report test"),
		);
		console.log("📤 Sent to Sentry. Event ID:", eventId);

		// Force flush to ensure it sends immediately
		await Sentry.flush(2000);
		console.log("✅ Flushed to Sentry");

		toast.success(`Error sent! Event ID: ${eventId}`);
	};

	const handleMessage = async () => {
		const eventId = Sentry.captureMessage("Test message from OFFWORLD", "info");
		console.log("📤 Sent message to Sentry. Event ID:", eventId);
		await Sentry.flush(2000);
		toast.success(`Message sent! Event ID: ${eventId}`);
	};

	return (
		<div className="container mx-auto px-4 py-16">
			<h1 className="mb-8 font-bold text-3xl">Sentry Error Testing</h1>

			<p className="mb-4 text-muted-foreground text-sm">
				Environment: <span className="font-mono">{import.meta.env.MODE}</span>
			</p>
			<p className="mb-8 text-muted-foreground text-sm">
				DSN configured: {import.meta.env.VITE_SENTRY_DSN ? "✅ Yes" : "❌ No"}
			</p>

			<div className="space-y-4">
				<div>
					<Button onClick={() => setShouldBreak(true)}>
						1. Throw Render Error (Error Boundary)
					</Button>
					<p className="mt-2 text-muted-foreground text-sm">
						Triggers error boundary + Sentry report
					</p>
				</div>

				<div>
					<Button onClick={handleManualReport}>2. Manual Sentry Report</Button>
					<p className="mt-2 text-muted-foreground text-sm">
						Directly sends to Sentry (watch console for Event ID)
					</p>
				</div>

				<div>
					<Button onClick={handleMessage}>3. Send Test Message</Button>
					<p className="mt-2 text-muted-foreground text-sm">
						Sends info-level message to Sentry
					</p>
				</div>

				<div>
					<Button
						onClick={() => {
							// Unhandled promise rejection
							Promise.reject(new Error("Unhandled promise rejection test"));
						}}
					>
						4. Unhandled Promise Rejection
					</Button>
					<p className="mt-2 text-muted-foreground text-sm">
						Should be caught by Sentry automatically
					</p>
				</div>

				<div>
					<Button
						onClick={() => {
							setTimeout(() => {
								throw new Error("Error from setTimeout");
							}, 100);
						}}
					>
						5. Async Timeout Error
					</Button>
					<p className="mt-2 text-muted-foreground text-sm">
						Global error handler test
					</p>
				</div>
			</div>

			{shouldBreak && <BrokenComponent shouldBreak={shouldBreak} />}
		</div>
	);
}
