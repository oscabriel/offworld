import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface InstallCommandBoxProps {
	fullName: string;
	label?: string;
}

export function InstallCommandBox({
	fullName,
	label = "Install this skill",
}: InstallCommandBoxProps) {
	const [copied, setCopied] = useState(false);
	const command = `bunx offworld pull ${fullName}`;

	const copyCommand = () => {
		navigator.clipboard.writeText(command);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="bg-muted/50 border-primary/10 border">
			<div className="text-muted-foreground border-primary/10 border-b px-5 py-2 font-mono text-xs">
				{label}
			</div>
			<div className="flex items-center gap-3 p-5">
				<code className="flex items-center gap-2 font-mono text-sm">
					<span className="text-muted-foreground select-none">$</span>
					<span className="text-foreground">{command}</span>
				</code>
				<Button variant="ghost" size="icon-sm" onClick={copyCommand} className="shrink-0">
					{copied ? <Check className="size-3" /> : <Copy className="size-3" />}
				</Button>
			</div>
		</div>
	);
}
