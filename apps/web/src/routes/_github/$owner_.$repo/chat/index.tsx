import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_github/$owner_/$repo/chat/")({
	component: ChatPage,
});

function ChatPage() {
	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-primary/10 bg-card p-12 text-center">
				<p className="font-serif text-lg text-muted-foreground">
					Chat interface coming soon...
				</p>
				<p className="mt-4 font-mono text-muted-foreground text-sm">
					This will feature streaming AI responses with vector search and code
					context.
				</p>
			</div>
		</div>
	);
}
