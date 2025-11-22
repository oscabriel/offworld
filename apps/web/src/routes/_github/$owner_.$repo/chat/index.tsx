import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { ContentCard } from "@/components/repo/content-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_github/$owner_/$repo/chat/")({
	component: ChatPage,
});

function ChatPage() {
	const { owner, repo } = Route.useParams();
	const navigate = useNavigate();
	const fullName = `${owner}/${repo}`;

	// Auth check
	const user = useQuery(api.auth.getCurrentUserSafe);

	// Get repo data
	const repoData = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	const createThread = useMutation(api.chat.createThread);

	// Handle first message (create thread and navigate)
	const handleStartConversation = async (initialMessage: string) => {
		if (!repoData?._id) return;

		try {
			const result = await createThread({
				repositoryId: repoData._id,
				initialMessage,
			});

			// Navigate to the new conversation
			navigate({
				to: "/$owner/$repo/chat/$chatId",
				params: { owner, repo, chatId: result.conversationId },
			});
		} catch (error) {
			// Silent error handling
		}
	};

	// Loading state
	if (user === undefined || repoData === undefined) {
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

	// Indexing in progress
	if (repoData.indexingStatus !== "completed") {
		return (
			<ContentCard variant="warning">
				<h3 className="mb-2 font-mono font-semibold text-lg">
					⚡ Indexing in Progress
				</h3>
				<p className="font-mono text-muted-foreground text-sm">
					Chat will be available once indexing completes.
				</p>
			</ContentCard>
		);
	}

	// Empty state - start new conversation
	return (
		<ContentCard>
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<MessageSquarePlus className="mb-4 h-16 w-16 text-muted-foreground" />
				<h2 className="mb-2 font-mono font-semibold text-2xl">
					Start a Conversation
				</h2>
				<p className="mb-6 max-w-md font-serif text-lg text-muted-foreground leading-relaxed">
					Ask questions about {owner}/{repo}'s architecture, find issues to work
					on, or explore the codebase with AI assistance.
				</p>
				<StartConversationForm onSubmit={handleStartConversation} />
			</div>
		</ContentCard>
	);
}

function StartConversationForm({
	onSubmit,
}: {
	onSubmit: (msg: string) => void;
}) {
	const [input, setInput] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (input.trim()) {
			onSubmit(input);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
			<Input
				value={input}
				onChange={(e) => setInput(e.target.value)}
				placeholder="What would you like to know?"
				className="flex-1"
			/>
			<Button type="submit" disabled={!input.trim()}>
				Start Chat
			</Button>
		</form>
	);
}
