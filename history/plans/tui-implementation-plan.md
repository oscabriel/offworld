# Offworld TUI Implementation Plan

> **Status:** Approved  
> **Created:** January 2026  
> **Location:** `apps/tui/`

---

## Overview

**Goal:** Interactive terminal UI for managing indexed clones and installed skills. Launches only via `ow` (no args) in a TTY; no standalone `ow tui` command.

**Design Inspiration:**

- **lazygit**: Panel-based layout, vim keybindings, status bar with keybind hints
- **btop**: Section headers, colored status indicators, responsive design

**Framework:** OpenTUI React (`@opentui/react` on `@opentui/core`). Pure terminal UI, Node runtime, no browser surface.

**Data Sources:**

- Repo index via `@offworld/sdk` (`listRepos()` -> `RepoIndexEntry[]`)
- Skills + meta from `getSkillPath(fullName)` and `getMetaPath(fullName)`

---

## Key Decisions

| Decision        | Choice                                  | Rationale                            |
| --------------- | --------------------------------------- | ------------------------------------ |
| TUI entry point | `ow` (no args + TTY)                    | Single entry point, no extra command |
| Renderer        | `@opentui/react` + `@opentui/core`      | Component ergonomics, native TUI     |
| Data model      | `RepoIndexEntry` from `@offworld/types` | Matches existing CLI + SDK           |
| Actions         | SDK functions (no CLI subprocess)       | Predictable behavior, easier testing |
| Theme           | Dark only (Nord-inspired)               | Matches btop/lazygit aesthetic       |

---

## Entry Point

```bash
ow              # Launches TUI (no args, TTY required)
ow --help       # Shows CLI help
ow pull <repo>  # Direct CLI command
```

The TUI is the "home screen" for Offworld. When args are present or the output is non-TTY, the standard CLI runs.

---

## Architecture

### Directory Structure

```
apps/tui/
├── src/
│   ├── index.tsx              # createCliRenderer + createRoot + launchTui
│   ├── App.tsx                # Root layout + global keyboard handler
│   ├── actions/
│   │   ├── pull.ts            # SDK-backed pull flow
│   │   ├── generate.ts        # SDK-backed generate flow
│   │   └── remove.ts          # SDK-backed remove flow
│   ├── components/
│   │   ├── Layout.tsx         # 3-panel layout wrapper
│   │   ├── Header.tsx         # ASCII logo + version
│   │   ├── StatusBar.tsx      # Keybind hints footer
│   │   ├── Sidebar/
│   │   │   ├── RepoTree.tsx   # Provider > Owner > Repo tree
│   │   │   └── TreeItem.tsx   # Individual tree node
│   │   ├── MainPanel/
│   │   │   ├── RepoDetail.tsx     # Selected repo info
│   │   │   ├── SkillPreview.tsx   # SKILL.md content viewer
│   │   │   └── AnalysisStatus.tsx # Analysis state + actions
│   │   ├── Modals/
│   │   │   ├── ConfirmDialog.tsx  # Y/N confirmation
│   │   │   ├── ActionMenu.tsx     # Pull/Generate/Remove menu
│   │   │   └── HelpModal.tsx      # Full keybind reference
│   │   └── shared/
│   │       ├── Panel.tsx          # Bordered panel wrapper
│   │       ├── StatusBadge.tsx    # Analyzed/Stale/None indicator
│   │       └── Spinner.tsx        # Loading indicator
│   ├── store/
│   │   └── state.ts           # Zustand store for app state
│   ├── types.ts               # TUI-specific types
│   ├── utils/
│   │   ├── repo.ts            # Qualified name parsing helpers
│   │   └── time.ts            # Relative time formatting
│   └── theme.ts               # Color palette + border styles
├── package.json
└── tsconfig.json
```

### Data Model

`RepoIndexEntry` is the source of truth; TUI derives view-specific fields.

```ts
// types.ts
import type { RepoIndexEntry } from "@offworld/types";

export interface TuiRepo extends RepoIndexEntry {
	analyzed: boolean;
	isStale: boolean;
	exists: boolean;
	analysisStatus: "analyzed" | "stale" | "none";
}
```

---

## Visual Design

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  OFFWORLD                                          v0.1.0  [?]  │
├──────────────────────┬──────────────────────────────────────────┤
│  REPOS               │  tanstack/router                         │
│  ──────────────────  │  ─────────────────────────────────────── │
│  ▾ github            │  Status: ● Analyzed                       │
│    ▸ tanstack        │  Analyzed: 2026-01-07                      │
│      ● router      ← │  Commit: a1b2c3d4                          │
│      ○ query         │  Path:   ~/ow/github/tanstack/router       │
│    ▸ vercel          │                                            │
│      ⚠ ai            │  ┌─ SKILL.md ─────────────────────────┐    │
│  ▾ gitlab            │  │ ---                                │    │
│    ▸ inkscape        │  │ name: tanstack-router-reference    │    │
│      ● inkscape      │  │ description: Consult cloned...     │    │
│                      │  │ ---                                │    │
│                      │  │                                    │    │
│                      │  │ # TanStack Router Source Reference │    │
│                      │  │                                    │    │
│                      │  │ ## Repository Structure            │    │
│                      │  └────────────────────────────────────┘    │
├──────────────────────┴──────────────────────────────────────────┤
│  [p]ull  [g]enerate  [r]emove  [/]search  [?]help  [q]uit       │
└─────────────────────────────────────────────────────────────────┘
```

### Status Indicators

| Symbol | Color                 | Meaning                                  |
| ------ | --------------------- | ---------------------------------------- |
| `●`    | Green (`#a3be8c`)     | Skill installed, commit matches          |
| `⚠`    | Yellow (`#ebcb8b`)    | Skill installed, commit mismatch (stale) |
| `○`    | Dim white (`#4c566a`) | No skill installed                       |
| `▸`    | Default               | Collapsed group                          |
| `▾`    | Default               | Expanded group                           |

### Color Palette (Nord-inspired)

```ts
// theme.ts
export const colors = {
	// Backgrounds
	bg: "#2e3440",
	bgLight: "#3b4252",
	bgHighlight: "#434c5e",

	// Foregrounds
	fg: "#d8dee9",
	fgDim: "#4c566a",
	fgBright: "#eceff4",

	// Accents
	accent: "#81a1c1",
	accentAlt: "#88c0d0",

	// Status
	success: "#a3be8c",
	warning: "#ebcb8b",
	error: "#bf616a",
	info: "#5e81ac",
};

export const borders = {
	panel: "rounded",
	modal: "double",
	focused: "heavy",
} as const;
```

---

## Component Specifications

### 1. App.tsx (Root)

```tsx
import { useKeyboard } from "@opentui/react";
import { colors } from "./theme";
import { useStore } from "./store/state";
import { Header } from "./components/Header";
import { Layout } from "./components/Layout";
import { RepoTree } from "./components/Sidebar/RepoTree";
import { RepoDetail } from "./components/MainPanel/RepoDetail";
import { StatusBar } from "./components/StatusBar";
import { HelpModal } from "./components/Modals/HelpModal";
import { ActionMenu } from "./components/Modals/ActionMenu";

export const App = () => {
	const { activePanel, setActivePanel, modal, setModal, selectedRepo } = useStore();

	useKeyboard((e) => {
		if (modal) return;

		switch (e.name) {
			case "tab":
				setActivePanel(activePanel === "sidebar" ? "main" : "sidebar");
				break;
			case "return":
				if (selectedRepo) setModal("action");
				break;
			case "?":
				setModal("help");
				break;
			case "q":
				process.exit(0);
		}
	});

	return (
		<box flexDirection="column" flexGrow={1} backgroundColor={colors.bg}>
			<Header />
			<Layout>
				<RepoTree focused={activePanel === "sidebar"} />
				<RepoDetail focused={activePanel === "main"} />
			</Layout>
			<StatusBar />
			{modal === "help" && <HelpModal onClose={() => setModal(null)} />}
			{modal === "action" && <ActionMenu onClose={() => setModal(null)} />}
		</box>
	);
};
```

### 2. Panel.tsx (Shared)

```tsx
import { colors, borders } from "../theme";

interface PanelProps {
	title?: string;
	focused?: boolean;
	children: React.ReactNode;
}

export const Panel = ({ title, focused, children }: PanelProps) => (
	<box
		border
		borderStyle={focused ? borders.focused : borders.panel}
		borderColor={focused ? colors.accent : colors.fgDim}
		flexDirection="column"
		flexGrow={1}
	>
		{title && (
			<box paddingLeft={1} paddingRight={1}>
				<text content={` ${title} `} fg={focused ? colors.accent : colors.fg} />
			</box>
		)}
		<box flexGrow={1} padding={1}>
			{children}
		</box>
	</box>
);
```

### 3. RepoTree.tsx (Sidebar)

```tsx
import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useStore } from "../../store/state";
import { TreeItem } from "./TreeItem";
import { Panel } from "../shared/Panel";
import type { TuiRepo } from "../../types";
import { splitQualifiedName } from "../../utils/repo";

interface TreeNode {
	id: string;
	type: "provider" | "owner" | "repo";
	name: string;
	expanded?: boolean;
	children?: TreeNode[];
	status?: "analyzed" | "stale" | "none";
}

export const RepoTree = ({ focused }: { focused: boolean }) => {
	const { repos, selectedRepo, selectRepo, expandedNodes, toggleExpanded } = useStore();
	const [cursor, setCursor] = useState(0);

	const tree = buildTree(repos);
	const flatList = flattenTree(tree, expandedNodes);

	useKeyboard((e) => {
		if (!focused) return;

		switch (e.name) {
			case "j":
			case "down":
				setCursor(Math.min(cursor + 1, flatList.length - 1));
				break;
			case "k":
			case "up":
				setCursor(Math.max(cursor - 1, 0));
				break;
			case "l":
			case "right":
			case "return": {
				const item = flatList[cursor];
				if (!item) return;
				if (item.type === "repo") {
					selectRepo(item.id);
				} else {
					toggleExpanded(item.id);
				}
				break;
			}
			case "h":
			case "left": {
				const current = flatList[cursor];
				if (!current) return;
				if (current.type !== "provider") {
					toggleExpanded(current.id);
				}
				break;
			}
			case "g":
				if (e.repeated) setCursor(0); // gg
				break;
			case "G":
				setCursor(flatList.length - 1);
				break;
		}
	});

	return (
		<Panel title="REPOS" focused={focused}>
			<scrollbox flexGrow={1}>
				{flatList.map((node, i) => (
					<TreeItem
						key={node.id}
						node={node}
						selected={i === cursor}
						active={node.id === selectedRepo}
						depth={node.depth}
					/>
				))}
			</scrollbox>
		</Panel>
	);
};

// Transform flat repo list to tree structure
function buildTree(repos: TuiRepo[]): TreeNode[] {
	const providers: Record<string, Record<string, TreeNode[]>> = {};

	for (const repo of repos) {
		const { provider, owner, name } = splitQualifiedName(repo.qualifiedName, repo.fullName);
		providers[provider] ??= {};
		providers[provider][owner] ??= [];
		providers[provider][owner].push({
			id: repo.qualifiedName,
			type: "repo",
			name,
			status: repo.analysisStatus,
		});
	}

	return Object.entries(providers).map(([provider, owners]) => ({
		id: provider,
		type: "provider",
		name: provider,
		children: Object.entries(owners).map(([owner, repos]) => ({
			id: `${provider}:${owner}`,
			type: "owner",
			name: owner,
			children: repos,
		})),
	}));
}
```

### 4. TreeItem.tsx

```tsx
import { TextAttributes } from "@opentui/core";
import { colors } from "../../theme";

interface TreeItemProps {
	node: TreeNode;
	selected: boolean;
	active: boolean;
	depth: number;
}

const STATUS_ICONS = {
	analyzed: { icon: "●", color: colors.success },
	stale: { icon: "⚠", color: colors.warning },
	none: { icon: "○", color: colors.fgDim },
};

export const TreeItem = ({ node, selected, active, depth }: TreeItemProps) => {
	const indent = "  ".repeat(depth);
	const expandIcon = node.type !== "repo" ? (node.expanded ? "▾ " : "▸ ") : "";
	const statusIcon = node.status ? STATUS_ICONS[node.status] : null;

	return (
		<box
			backgroundColor={selected ? colors.bgHighlight : undefined}
			paddingLeft={1}
			paddingRight={1}
		>
			<text fg={colors.fgDim}>{indent}</text>
			{expandIcon && <text fg={colors.fg}>{expandIcon}</text>}
			{statusIcon && <text fg={statusIcon.color}>{statusIcon.icon} </text>}
			<text
				fg={active ? colors.accentAlt : colors.fg}
				attributes={active ? TextAttributes.BOLD : TextAttributes.NONE}
			>
				{node.name}
			</text>
			{active && <text fg={colors.accent}> ←</text>}
		</box>
	);
};
```

### 5. RepoDetail.tsx (Main Panel)

```tsx
import { useStore } from "../../store/state";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";
import { SkillPreview } from "./SkillPreview";
import { colors } from "../../theme";
import { formatRelative } from "../../utils/time";

export const RepoDetail = ({ focused }: { focused: boolean }) => {
	const { selectedRepo, repos } = useStore();
	const repo = repos.find((r) => r.qualifiedName === selectedRepo);

	if (!repo) {
		return (
			<Panel title="DETAILS" focused={focused}>
				<box alignItems="center" justifyContent="center" flexGrow={1}>
					<text fg={colors.fgDim}>Select a repository</text>
				</box>
			</Panel>
		);
	}

	return (
		<Panel title={repo.fullName} focused={focused}>
			<box flexDirection="column" flexGrow={1}>
				<box marginBottom={1}>
					<StatusBadge status={repo.analysisStatus} />
					{!repo.exists && <text fg={colors.error}> (missing on disk)</text>}
				</box>

				{repo.analyzedAt && (
					<text fg={colors.fgDim}>Analyzed: {formatRelative(repo.analyzedAt)}</text>
				)}
				{repo.commitSha && <text fg={colors.fgDim}>Commit: {repo.commitSha.slice(0, 8)}</text>}
				<text fg={colors.fgDim}>Path: {repo.localPath}</text>

				<box marginTop={2} flexGrow={1}>
					<SkillPreview repo={repo} />
				</box>
			</box>
		</Panel>
	);
};
```

### 6. SkillPreview.tsx

```tsx
import { useState, useEffect } from "react";
import { readFile } from "node:fs/promises";
import { getSkillPath } from "@offworld/sdk";
import type { TuiRepo } from "../../types";
import { colors } from "../../theme";

export const SkillPreview = ({ repo }: { repo: TuiRepo }) => {
	const [content, setContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const loadSkill = async () => {
			if (!repo.hasSkill) {
				setContent(null);
				return;
			}

			setLoading(true);
			try {
				const skillPath = `${getSkillPath(repo.fullName)}/SKILL.md`;
				const text = await readFile(skillPath, "utf-8");
				setContent(text);
			} catch {
				setContent(null);
			} finally {
				setLoading(false);
			}
		};
		loadSkill();
	}, [repo.fullName, repo.hasSkill]);

	if (loading) {
		return <text fg={colors.fgDim}>Loading...</text>;
	}

	if (!content) {
		return (
			<box
				border
				borderStyle="rounded"
				borderColor={colors.fgDim}
				alignItems="center"
				justifyContent="center"
				flexGrow={1}
			>
				<text fg={colors.fgDim}>No skill file installed</text>
			</box>
		);
	}

	return (
		<box border borderStyle="rounded" borderColor={colors.fgDim} flexGrow={1}>
			<box paddingLeft={1}>
				<text fg={colors.accent}> SKILL.md </text>
			</box>
			<scrollbox flexGrow={1} padding={1}>
				<code content={content} filetype="markdown" />
			</scrollbox>
		</box>
	);
};
```

### 7. ActionMenu.tsx (Modal)

```tsx
import { useKeyboard } from "@opentui/react";
import { useStore } from "../../store/state";
import { colors, borders } from "../../theme";

interface ActionMenuProps {
	onClose: () => void;
}

export const ActionMenu = ({ onClose }: ActionMenuProps) => {
	const { selectedRepo, executeAction, loading } = useStore();

	const options = [
		{ name: "Pull", description: "Update repo + refresh analysis", value: "pull", key: "p" },
		{ name: "Generate", description: "Force local AI analysis", value: "generate", key: "g" },
		{ name: "Remove", description: "Delete repo and analysis", value: "remove", key: "r" },
	];

	useKeyboard((e) => {
		if (e.name === "escape") {
			onClose();
			return;
		}

		const option = options.find((o) => o.key === e.name);
		if (option && !loading) {
			handleAction(option.value);
		}
	});

	const handleAction = async (action: string) => {
		if (!selectedRepo) return;
		await executeAction(action as "pull" | "generate" | "remove");
		onClose();
	};

	return (
		<box
			position="absolute"
			top="30%"
			left="25%"
			width="50%"
			backgroundColor={colors.bg}
			border
			borderStyle={borders.modal}
			borderColor={colors.accent}
		>
			<box paddingLeft={1}>
				<text fg={colors.accent}> Actions </text>
			</box>
			<select
				focused
				options={options.map((o) => ({
					name: `[${o.key}] ${o.name}`,
					description: o.description,
					value: o.value,
				}))}
				onSelect={(_, opt) => opt && handleAction(opt.value)}
				style={{ padding: 1 }}
			/>
			{loading && (
				<box padding={1}>
					<text fg={colors.warning}>Processing...</text>
				</box>
			)}
		</box>
	);
};
```

### 8. StatusBar.tsx

```tsx
import { useStore } from "../store/state";
import { colors } from "../theme";

const KEYBINDS = [
	{ key: "p", label: "pull" },
	{ key: "g", label: "generate" },
	{ key: "r", label: "remove" },
	{ key: "/", label: "search" },
	{ key: "?", label: "help" },
	{ key: "q", label: "quit" },
];

export const StatusBar = () => {
	const { loading, error } = useStore();

	return (
		<box backgroundColor={colors.bgLight} paddingLeft={1} paddingRight={1}>
			{loading ? (
				<text fg={colors.warning}>Processing...</text>
			) : error ? (
				<text fg={colors.error}>{error}</text>
			) : (
				<box flexDirection="row">
					{KEYBINDS.map(({ key, label }) => (
						<box key={key} marginRight={2}>
							<text fg={colors.accent}>[{key}]</text>
							<text fg={colors.fgDim}>{label}</text>
						</box>
					))}
				</box>
			)}
		</box>
	);
};
```

### 9. Header.tsx

```tsx
import { colors } from "../theme";

export const Header = () => (
	<box
		backgroundColor={colors.bgLight}
		paddingLeft={1}
		paddingRight={1}
		justifyContent="space-between"
	>
		<ascii-font text="OFFWORLD" font="tiny" fg={colors.accent} />
		<box alignItems="flex-end">
			<text fg={colors.fgDim}>v0.1.0</text>
			<text fg={colors.accent} marginLeft={2}>
				[?]
			</text>
		</box>
	</box>
);
```

---

## State Management

### Zustand Store

```ts
// store/state.ts
import { create } from "zustand";
import { listRepos, getCommitSha } from "@offworld/sdk";
import type { RepoIndexEntry } from "@offworld/types";
import { existsSync } from "node:fs";
import { pullRepo } from "../actions/pull";
import { generateRepo } from "../actions/generate";
import { removeRepo } from "../actions/remove";
import type { TuiRepo } from "../types";

interface TUIState {
	// Data
	repos: TuiRepo[];
	selectedRepo: string | null;
	expandedNodes: Set<string>;

	// UI
	activePanel: "sidebar" | "main";
	modal: "help" | "action" | "confirm" | null;
	loading: boolean;
	error: string | null;

	// Actions
	loadRepos: () => Promise<void>;
	selectRepo: (qualifiedName: string) => void;
	toggleExpanded: (id: string) => void;
	setActivePanel: (panel: "sidebar" | "main") => void;
	setModal: (modal: "help" | "action" | "confirm" | null) => void;
	executeAction: (action: "pull" | "generate" | "remove") => Promise<void>;
	clearError: () => void;
}

export const useStore = create<TUIState>((set, get) => ({
	// Initial state
	repos: [],
	selectedRepo: null,
	expandedNodes: new Set(["github"]),
	activePanel: "sidebar",
	modal: null,
	loading: false,
	error: null,

	// Actions
	loadRepos: async () => {
		set({ loading: true, error: null });
		try {
			const entries = listRepos();
			const repos = entries.map(deriveRepo);
			set({ repos, loading: false });
		} catch (error) {
			set({ error: error instanceof Error ? error.message : "Unknown error", loading: false });
		}
	},

	selectRepo: (qualifiedName) => {
		set({ selectedRepo: qualifiedName });
	},

	toggleExpanded: (id) => {
		const { expandedNodes } = get();
		const next = new Set(expandedNodes);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		set({ expandedNodes: next });
	},

	setActivePanel: (panel) => set({ activePanel: panel }),
	setModal: (modal) => set({ modal }),
	clearError: () => set({ error: null }),

	executeAction: async (action) => {
		const { selectedRepo, repos, loadRepos } = get();
		if (!selectedRepo) return;

		const repo = repos.find((entry) => entry.qualifiedName === selectedRepo);
		if (!repo) return;

		set({ loading: true, error: null });
		try {
			switch (action) {
				case "pull":
					await pullRepo(repo);
					break;
				case "generate":
					await generateRepo(repo);
					break;
				case "remove":
					await removeRepo(repo);
					break;
			}
			await loadRepos();
		} catch (error) {
			set({ error: error instanceof Error ? error.message : "Unknown error" });
		} finally {
			set({ loading: false });
		}
	},
}));

function deriveRepo(entry: RepoIndexEntry): TuiRepo {
	const exists = existsSync(entry.localPath);
	const analyzed = entry.hasSkill || !!entry.analyzedAt;
	let isStale = false;

	if (exists && analyzed && entry.commitSha) {
		try {
			const currentSha = getCommitSha(entry.localPath);
			isStale = currentSha !== entry.commitSha;
		} catch {
			isStale = false;
		}
	}

	const analysisStatus = analyzed ? (isStale ? "stale" : "analyzed") : "none";

	return {
		...entry,
		exists,
		analyzed,
		isStale,
		analysisStatus,
	};
}
```

---

## Action Flows (SDK-backed)

### Pull

- Update repo (`updateRepo`) and get current commit SHA
- If skill already installed and commit matches, no-op
- For remote repos, try `checkRemote` + `pullAnalysis` when SHAs match
- Fallback: generate locally via `generateSkillWithAI`
- Install skill (`installSkill`) + update index (`updateIndex`)

### Generate

- Generate locally via `generateSkillWithAI`
- Install skill (`installSkill`) + update index (`updateIndex`)

### Remove

- Remove repo + skill via `removeRepo` (no CLI subprocess)
- Update UI state after removal

---

## Keybindings Reference

### Global

| Key   | Action               |
| ----- | -------------------- |
| `Tab` | Switch panel focus   |
| `q`   | Quit                 |
| `?`   | Show help modal      |
| `/`   | Focus search input   |
| `Esc` | Close modal / cancel |

### Sidebar (Tree Navigation)

| Key                 | Action          |
| ------------------- | --------------- |
| `j` / `↓`           | Move down       |
| `k` / `↑`           | Move up         |
| `l` / `→` / `Enter` | Expand / Select |
| `h` / `←`           | Collapse / Back |
| `gg`                | Go to top       |
| `G`                 | Go to bottom    |
| `Space`             | Toggle expand   |

### Main Panel

| Key       | Action      |
| --------- | ----------- |
| `j` / `↓` | Scroll down |
| `k` / `↑` | Scroll up   |

### Actions (with repo selected)

| Key     | Action             |
| ------- | ------------------ |
| `p`     | Pull selected repo |
| `g`     | Generate analysis  |
| `r`     | Remove repo        |
| `Enter` | Open action menu   |

---

## CLI Integration

### Entry Point Modification

```ts
// apps/cli/src/cli.ts
import { loadDevEnv } from "./env-loader.js";
import { createOwCli } from "./index.js";

loadDevEnv();

const args = process.argv.slice(2);

// Launch TUI if no args and in TTY
if (args.length === 0 && process.stdout.isTTY) {
	const { launchTui } = await import("@offworld/tui");
	await launchTui();
} else {
	createOwCli().run();
}
```

### TUI Entry

```ts
// apps/tui/src/index.tsx
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./App";
import { useStore } from "./store/state";

export async function launchTui() {
	const renderer = await createCliRenderer({ exitOnCtrlC: true });

	// Load initial data
	await useStore.getState().loadRepos();

	// Mount React app
	createRoot(renderer).render(<App />);
}
```

---

## Dependencies

```json
{
	"name": "@offworld/tui",
	"version": "0.1.0",
	"private": true,
	"type": "module",
	"module": "src/index.tsx",
	"scripts": {
		"dev": "bun run --watch src/index.tsx"
	},
	"dependencies": {
		"@offworld/sdk": "workspace:*",
		"@offworld/types": "workspace:*",
		"@opentui/core": "^0.1.74",
		"@opentui/react": "^0.1.74",
		"react": "^19.0.0",
		"zustand": "^5.0.0"
	},
	"devDependencies": {
		"@types/react": "^19.0.0",
		"@offworld/config": "workspace:*",
		"typescript": "catalog:"
	}
}
```

---

## Implementation Phases

### Phase 1: Foundation (Core Layout)

**Tasks:**

- [ ] Convert `apps/tui/` to OpenTUI React entry (`index.tsx` + `launchTui`)
- [ ] Create `theme.ts` with colors/borders
- [ ] Build `Panel` component (bordered box with title)
- [ ] Build `Header` with ASCIIFont logo
- [ ] Build `StatusBar` with keybind hints
- [ ] Create 3-panel `Layout` component
- [ ] Wire up global keyboard handler

**Deliverable:** Empty layout with panels, header, status bar renders correctly

### Phase 2: Data Layer

**Tasks:**

- [ ] Create Zustand store for state
- [ ] Load repos from `listRepos()` and derive `TuiRepo`
- [ ] Compute staleness via `getCommitSha`
- [ ] Add loading/error states

**Deliverable:** TUI loads and displays indexed repos

### Phase 3: Sidebar Navigation

**Tasks:**

- [ ] Build `RepoTree` component
- [ ] Build `TreeItem` component with expand/collapse
- [ ] Implement keyboard navigation (j/k/h/l)
- [ ] Add status indicators (●/⚠/○)
- [ ] Implement search/filter

**Deliverable:** Navigable tree view of local repos

### Phase 4: Main Panel

**Tasks:**

- [ ] Build `RepoDetail` component
- [ ] Build `SkillPreview` with scrollbox + markdown
- [ ] Build `AnalysisStatus` component
- [ ] Connect selection to detail view
- [ ] Implement scrolling in preview

**Deliverable:** Selected repo displays full details + skill preview

### Phase 5: Actions & Modals

**Tasks:**

- [ ] Build `ActionMenu` modal
- [ ] Build `ConfirmDialog` modal
- [ ] Build `HelpModal` with full keybind reference
- [ ] Implement SDK-backed action flows (pull/generate/remove)
- [ ] Add spinner for async operations
- [ ] Handle errors with user feedback

**Deliverable:** Users can pull/generate/remove repos from TUI

### Phase 6: Polish

**Tasks:**

- [ ] Responsive layout for different terminal sizes
- [ ] Empty states for all panels
- [ ] Error recovery / retry
- [ ] Persist UI state (expanded nodes) across sessions
- [ ] CLI integration (`ow` with no args launches TUI)

**Deliverable:** Production-ready TUI

---

## Success Criteria

- [ ] TUI launches without noticeable delay
- [ ] All indexed repos visible and navigable
- [ ] Pull/Generate/Remove work from TUI
- [ ] SKILL.md preview renders correctly
- [ ] No crashes on edge cases (empty state, missing files)
- [ ] Works in 80x24 minimum terminal size
- [ ] Keyboard-only navigation (no mouse required)

---

_Created: January 2026_
