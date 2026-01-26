import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const installCommands = [
	{ id: "curl", label: "curl", command: "curl -fsSL https://offworld.sh/install | bash" },
	{ id: "npm", label: "npm", command: "npm install -g offworld" },
	{ id: "bun", label: "bun", command: "bun add -g offworld" },
	{ id: "brew", label: "brew", command: "brew install oscabriel/tap/offworld" },
] as const;

interface InstallTabsProps {
	className?: string;
	variant?: "default" | "compact";
}

export function InstallTabs({ className, variant = "default" }: InstallTabsProps) {
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState<string>("curl");

	const activeCommand = installCommands.find((c) => c.id === activeTab)?.command ?? "";

	const copyCommand = () => {
		navigator.clipboard.writeText(activeCommand);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	const isCompact = variant === "compact";

	return (
		<div className={cn("w-full", className)}>
			<Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
				{installCommands.map((cmd) => (
					<TabsContent
						key={cmd.id}
						value={cmd.id}
						className={cn(
							"border-primary/20 bg-background/30 group border backdrop-blur-sm",
							isCompact ? "px-3 py-3" : "px-5 py-5",
						)}
					>
						<button
							type="button"
							onClick={copyCommand}
							className="group/cmd flex w-full cursor-pointer items-center gap-2 overflow-x-auto"
						>
							<code className="text-foreground group-hover/cmd:text-muted-foreground flex items-center gap-2 font-mono text-base whitespace-nowrap transition-colors">
								<span className="select-none">$ </span>
								{cmd.command}
							</code>
							{copied ? (
								<Check className="size-4 shrink-0 text-green-500" />
							) : (
								<Copy className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover/cmd:opacity-100" />
							)}
						</button>
					</TabsContent>
				))}

				<div className="border-primary/20 bg-background/30 flex items-stretch border-x border-b backdrop-blur-sm">
					<TabsList variant="line" className="h-auto flex-1 justify-start gap-0 bg-transparent p-0">
						{installCommands.map((cmd) => (
							<TabsTrigger
								key={cmd.id}
								value={cmd.id}
								className={cn(
									"data-active:bg-primary/5 data-active:text-primary relative h-full px-5 py-2 font-mono text-base transition-colors",
									"hover:bg-primary/5",
									"border-none after:hidden",
									"data-active:before:bg-primary data-active:before:absolute data-active:before:inset-x-0 data-active:before:top-0 data-active:before:h-px",
								)}
							>
								{cmd.label}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
			</Tabs>
		</div>
	);
}
