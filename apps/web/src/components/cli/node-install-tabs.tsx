import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { nodeInstallCommands } from "@/lib/cli-data";

export function NodeInstallTabs() {
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState<string>("npm");

	const activeCommand = nodeInstallCommands.find((c) => c.id === activeTab)?.command ?? "";

	const copyCommand = () => {
		navigator.clipboard.writeText(activeCommand);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
			{nodeInstallCommands.map((cmd) => (
				<TabsContent
					key={cmd.id}
					value={cmd.id}
					className="border-primary/10 bg-card group border px-5 py-3"
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

			<div className="border-primary/10 bg-card flex items-stretch border-x border-b">
				<TabsList variant="line" className="h-auto flex-1 justify-start gap-0 bg-transparent p-0">
					{nodeInstallCommands.map((cmd) => (
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
	);
}
