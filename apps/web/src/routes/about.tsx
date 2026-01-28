import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
	component: AboutComponent,
});

function AboutComponent() {
	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-3xl flex-1 space-y-13 px-5 pb-21">
				<div className="space-y-5">
					<h1 className="font-serif text-5xl tracking-tight md:text-6xl">About</h1>
					<p className="text-primary font-mono text-lg italic">One skill for your whole stack.</p>
				</div>

				<div className="prose prose-neutral dark:prose-invert prose-headings:font-serif prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-primary max-w-none font-mono">
					<p>
						Offworld is a CLI that creates and manages local git clones of open source repos and
						generates reference files that tell your AI coding agents how to use them. Run{" "}
						<code>ow project init</code> and Offworld scans your dependencies, clones what you need,
						and installs a single skill that works across OpenCode, Claude Code, Cursor, and
						other agents.
					</p>

					<h2 className="font-serif">Rediscovery is expensive</h2>
					<p>
						Agents can always find your dependencies. But they pay for it every single
						time. Token burn to rediscover the same docs and source. Hallucinations when the context
						gets too deep. No memory between sessions.
					</p>
					<p>
						Stop asking the model to rediscover the same things every session. Keep that context
						ready and point your agent at it immediately.
					</p>

					<h2 className="font-serif">Source is the real docs</h2>
					<p>
						Docs links aren't enough. Your agent needs direct access to the source code. Point it at
						the actual source for a library and it'll generate code you actually want to ship.
					</p>
					<p>
						But keeping a huge list of git clones organized and updated is annoying. Offworld handles
						that for you by giving you commands to update cloned repos (one at a time or in bulk), create
						fresh reference files after pulling changes, and move where you store your git clones.
					</p>

					<h2 className="font-serif">Why this works</h2>
					<p>
						Everything stays in sync. The clone map persists across sessions. When you start a new
						conversation, your agent already knows your stack.
					</p>
					<p>
						Big companies like Vercel and Cloudflare ship first-party skills for their libraries.
						Smaller projects don't have that. Offworld generates references for any repo, so you get
						the same quality context whether you're using Next.js or a 200-star utility library.
					</p>
					<p>
						We generate from source on demand, not scrape or manually curate. Your manifest is the
						source of truth, not a marketplace. Agents load one small skill, then fetch exactly what
						they need.
					</p>

					<h2 className="font-serif">Get started</h2>
					<p>
						Install the CLI and run <code>ow project init</code> in any project directory.
					</p>
					<p>
						<Link to="/cli" className="text-primary hover:underline">
							Installation instructions
						</Link>{" "}
						/{" "}
						<Link to="/explore" className="text-primary hover:underline">
							Explore shared references
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
