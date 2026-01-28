import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	code: string;
	label?: string;
	className?: string;
}

export function CodeBlock({ code, label, className }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const copyCode = () => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className={cn("bg-card border-primary/10 border", className)}>
			{label && (
				<div className="text-muted-foreground border-primary/10 border-b px-5 py-3 text-left font-mono text-xs">
					{label}
				</div>
			)}
			<button
				type="button"
				onClick={copyCode}
				className="group flex w-full cursor-pointer items-center gap-2 overflow-x-auto px-5 py-3"
			>
				<code className="text-foreground group-hover:text-muted-foreground flex items-center gap-2 font-mono text-base whitespace-nowrap transition-colors">
					<span className="select-none">$</span>
					<span>{code}</span>
				</code>
				{copied ? (
					<Check className="size-4 text-green-500" />
				) : (
					<Copy className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
				)}
			</button>
		</div>
	);
}
