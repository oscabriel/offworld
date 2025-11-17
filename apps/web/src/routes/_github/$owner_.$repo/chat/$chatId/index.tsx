import { api } from "@offworld/backend/convex/_generated/api";
import type { Id } from "@offworld/backend/convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { MessageSquarePlus } from "lucide-react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ContentCard } from "@/components/repo/content-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_github/$owner_/$repo/chat/$chatId/")({
	component: ChatThreadPage,
});

function ChatThreadPage() {
	const { owner, repo, chatId } = Route.useParams();
	const navigate = useNavigate();
	const fullName = `${owner}/${repo}`;

	// Auth check
	const user = useQuery(api.auth.getCurrentUserSafe);

	// Get repo data
	const repoData = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	// Get conversation by ID
	const conversation = useQuery(api.chat.getConversation, {
		conversationId: chatId as Id<"conversations">,
	});

	// Loading state
	if (
		user === undefined ||
		repoData === undefined ||
		conversation === undefined
	) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-96 w-full rounded-lg" />
			</div>
		);
	}

	// Not authenticated
	if (!user) {
		return (
			<ContentCard title="Sign In Required">
				<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
					Please sign in to chat with the codebase explorer.
				</p>
				<Link
					to="/sign-in"
					className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
				>
					Sign In
				</Link>
			</ContentCard>
		);
	}

	// Repo not indexed
	if (!repoData) {
		return (
			<ContentCard title="Repository Not Indexed">
				<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
					This repository hasn't been analyzed yet. Please index it first.
				</p>
				<Link
					to="/$owner/$repo"
					params={{ owner, repo }}
					className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
				>
					Go to Summary
				</Link>
			</ContentCard>
		);
	}

	// Conversation not found or unauthorized
	if (!conversation) {
		return (
			<ContentCard title="Conversation Not Found">
				<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
					This conversation doesn't exist or you don't have access to it.
				</p>
				<Link
					to="/$owner/$repo/chat"
					params={{ owner, repo }}
					className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
				>
					Back to Chat
				</Link>
			</ContentCard>
		);
	}

	// Active conversation
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="truncate font-mono font-semibold text-2xl">
					{conversation.title}
				</h2>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						navigate({
							to: "/$owner/$repo/chat",
							params: { owner, repo },
						});
					}}
				>
					<MessageSquarePlus className="mr-2 h-4 w-4" />
					New Conversation
				</Button>
			</div>
			<ChatInterface
				conversationId={conversation._id}
				threadId={conversation.threadId}
			/>
		</div>
	);
}
