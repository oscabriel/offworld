import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import type { Id } from "@offworld/backend/convex/_generated/dataModel";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { MessageSquarePlus } from "lucide-react";
import { ChatInterface } from "@/components/chat/chat-interface";
import Loader from "@/components/loader";
import { ContentCard } from "@/components/repo/content-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_github/$owner_/$repo/chat/$chatId/")({
	component: ChatThreadPage,
	// Note: Parent layout ($owner_.$repo/route.tsx) already preloads repo data
	// No additional loader needed here - avoids redundant preloading
});

function ChatThreadPage() {
	const { owner, repo, chatId } = Route.useParams();
	const navigate = useNavigate();
	const fullName = `${owner}/${repo}`;

	// Use useConvexAuth to properly wait for Convex to validate the auth token
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	// Get repo data
	const { data: repoData } = useSuspenseQuery(
		convexQuery(api.repos.getByFullName, { fullName }),
	);

	// Get conversation by ID - only query when authenticated
	// Using non-suspense query with enabled flag to avoid errors before auth is ready
	const { data: conversation, isLoading: isConversationLoading } = useQuery({
		...convexQuery(api.chat.getConversation, {
			conversationId: chatId as Id<"conversations">,
		}),
		enabled: isAuthenticated,
	});

	// Show loading while Convex validates auth token
	if (isAuthLoading) {
		return <Loader />;
	}

	// Not authenticated - useConvexAuth ensures token is validated before this check
	if (!isAuthenticated) {
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

	// Loading conversation data
	if (isConversationLoading) {
		return <Loader />;
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
