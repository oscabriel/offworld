import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
	content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
	return (
		<div className="markdown-content font-serif text-lg leading-relaxed [&>code]:rounded [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:font-mono [&>code]:text-sm [&>h1]:mb-4 [&>h1]:font-mono [&>h1]:font-semibold [&>h1]:text-2xl [&>h2]:mb-3 [&>h2]:font-mono [&>h2]:font-semibold [&>h2]:text-xl [&>h3]:mb-2 [&>h3]:font-mono [&>h3]:font-semibold [&>h3]:text-lg [&>li]:leading-relaxed [&>ol]:mb-4 [&>ol]:ml-6 [&>ol]:list-decimal [&>ol]:space-y-2 [&>p]:mb-4 [&>p]:leading-relaxed [&>strong]:font-semibold [&>strong]:text-foreground [&>ul]:mb-4 [&>ul]:ml-6 [&>ul]:list-disc [&>ul]:space-y-2">
			<ReactMarkdown>{content}</ReactMarkdown>
		</div>
	);
}
