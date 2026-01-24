import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { type ErrorComponentProps } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui/button";

function getErrorMessage(error: unknown): string {
	if (error instanceof ConvexError) {
		const data = error.data;
		if (typeof data === "string") return data;
		if (typeof data === "object" && data && "message" in data) {
			return String(data.message);
		}
		return "A database error occurred";
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "An unexpected error occurred";
}

export function ErrorComponent({ error, reset: routerReset }: ErrorComponentProps) {
	const { reset: queryReset } = useQueryErrorResetBoundary();

	useEffect(() => {
		queryReset();
	}, [queryReset]);

	const handleRetry = () => {
		queryReset();
		routerReset();
	};

	const errorMessage = getErrorMessage(error);

	return (
		<div className="flex flex-1 items-center justify-center px-5 py-13">
			<div className="border-destructive/20 bg-destructive/5 w-full max-w-md space-y-5 border p-8">
				<div className="flex items-start gap-3">
					<AlertCircle className="text-destructive mt-0.5 size-5 shrink-0" />
					<div className="space-y-2">
						<h2 className="text-destructive font-serif text-xl">Something went wrong</h2>
						<p className="text-muted-foreground font-mono text-sm">{errorMessage}</p>
					</div>
				</div>
				<Button variant="outline" onClick={handleRetry} className="w-full">
					<RefreshCw className="size-4" />
					<span className="font-mono">Try again</span>
				</Button>
			</div>
		</div>
	);
}

export function NotFoundComponent() {
	return (
		<div className="flex flex-1 items-center justify-center px-5 py-13">
			<div className="border-primary/10 w-full max-w-md space-y-5 border p-8 text-center">
				<h2 className="font-serif text-5xl">404</h2>
				<p className="text-muted-foreground font-mono">Page not found</p>
			</div>
		</div>
	);
}
