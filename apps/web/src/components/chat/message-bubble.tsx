import type { UIMessage } from "@convex-dev/agent";
import { SmoothText } from "@convex-dev/agent/react";
import { Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
	message: UIMessage;
	isUser: boolean;
}

interface MessagePart {
	type: string;
	toolName?: string;
	toolCallId?: string;
	args?: unknown;
	output?: unknown;
	text?: string;
}

export function MessageBubble({ message, isUser }: MessageBubbleProps) {
	// Access the parts array - UIMessages combine multiple MessageDocs into parts
	// biome-ignore lint/suspicious/noExplicitAny: Convex agent library doesn't export UIMessage.parts type
	const parts = (message as any).parts as Array<MessagePart> | undefined;

	// Extract tool call parts - custom tools appear as "tool-{toolName}" or "dynamic-tool"
	const toolCallParts =
		parts?.filter(
			(part) => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
		) || [];

	// If this message has tool calls, render them as badges BEFORE the text
	const hasToolCalls = toolCallParts.length > 0;

	// Also get text parts for the main message
	const textParts = parts?.filter((part) => part.type === "text") || [];
	const hasText = textParts.length > 0 || message.text;

	// Render message
	return (
		<div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
			<div
				className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
			>
				{/* Tool call badges */}
				{hasToolCalls && (
					<div className="flex flex-col gap-1">
						{toolCallParts.map((part, idx) => {
							// Extract tool name from "tool-{name}" or use toolName property
							const toolName =
								part.toolName ||
								(part.type.startsWith("tool-")
									? part.type.slice("tool-".length)
									: part.type);

							return (
								<div
									key={idx}
									className="flex items-center gap-2 rounded-lg border border-muted-foreground/20 bg-muted/50 px-3 py-1.5 text-muted-foreground text-xs"
								>
									<Wrench className="h-3 w-3" />
									<span className="font-mono">{toolName}</span>
								</div>
							);
						})}
					</div>
				)}

				{/* Main message text */}
				{hasText && (
					<div
						className={`max-w-2xl rounded-lg px-4 py-2 ${
							isUser ? "bg-primary text-primary-foreground" : "bg-muted"
						}`}
					>
						{isUser ? (
							<p className="whitespace-pre-wrap font-mono text-sm">
								{message.text}
							</p>
						) : message.status === "streaming" ? (
							<div className="font-mono text-sm">
								<SmoothText text={message.text} />
							</div>
						) : (
							<div className="prose prose-sm dark:prose-invert prose-li:my-0 prose-p:my-2 prose-ul:my-2 max-w-none font-mono text-sm">
								<ReactMarkdown>{message.text}</ReactMarkdown>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
