import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface InstallCommandBoxProps {
	fullName: string;
	label?: string;
}

export function InstallCommandBox({
	fullName,
	label = "Install this reference",
}: InstallCommandBoxProps) {
	const [copied, setCopied] = useState(false);
	const command = `ow pull ${fullName}`;

	const copyCommand = () => {
		navigator.clipboard.writeText(command);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="bg-card border-primary/10 border">
			<div className="text-muted-foreground border-primary/10 border-b px-5 py-3 text-left font-mono text-xs">
				{label}
			</div>
			<button
				type="button"
				onClick={copyCommand}
				className="group flex w-full cursor-pointer items-center gap-2 px-5 py-3"
			>
				<code className="text-foreground group-hover:text-muted-foreground flex items-center gap-2 font-mono text-sm transition-colors">
					<span className="select-none">$</span>
					<span>{command}</span>
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
