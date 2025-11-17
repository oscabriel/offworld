import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "@offworld/backend/convex/_generated/api";
import type { Id } from "@offworld/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBubble } from "./MessageBubble";

interface ChatInterfaceProps {
	conversationId: Id<"conversations">;
	threadId: string;
}

export function ChatInterface({
	conversationId,
	threadId,
}: ChatInterfaceProps) {
	const [input, setInput] = useState("");
	const [isScrolled, setScrolled] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Streaming messages with agent
	const { results: messages, status } = useUIMessages(
		api.chat.listThreadMessages,
		{ threadId },
		{
			initialNumItems: 50,
			stream: true, // Enable streaming deltas
		},
	);

	const sendMessage = useMutation(api.chat.sendMessage);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		if (isScrolled) return;
		setTimeout(() => {
			if (scrollRef.current) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}
		}, 100);
	}, [isScrolled]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		try {
			await sendMessage({ conversationId, message: input });
			setInput("");
			setScrolled(false);
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	};

	const handleScroll = () => {
		if (!scrollRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
		setScrolled(!isAtBottom);
	};

	return (
		<div className="flex h-[calc(100vh-12rem)] flex-col rounded-lg border bg-card">
			{/* Messages */}
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto p-4"
			>
				<div className="space-y-4">
					{status === "LoadingFirstPage" ? (
						// Loading skeleton
						<>
							<div className="flex gap-3">
								<Skeleton className="h-8 w-8 rounded-full" />
								<Skeleton className="h-16 w-3/4 rounded-lg" />
							</div>
							<div className="ml-auto flex flex-row-reverse gap-3">
								<Skeleton className="h-8 w-8 rounded-full" />
								<Skeleton className="h-16 w-2/3 rounded-lg" />
							</div>
						</>
					) : (
						messages?.map((message) => (
							<MessageBubble
								key={message.key}
								message={message}
								isUser={!message.agentName}
							/>
						))
					)}

					{/* Streaming indicator */}
					{messages?.some((m) => m.status === "streaming") && (
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
							<span>Thinking...</span>
						</div>
					)}
				</div>
			</div>

			{/* Input */}
			<form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
				<Input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Ask about this codebase..."
					className="flex-1"
					disabled={messages?.some((m) => m.status === "streaming")}
				/>
				<Button
					type="submit"
					disabled={
						!input.trim() || messages?.some((m) => m.status === "streaming")
					}
				>
					<Send className="h-4 w-4" />
				</Button>
			</form>
		</div>
	);
}
