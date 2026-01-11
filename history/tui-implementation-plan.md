# Offworld TUI Implementation Plan

> **Status:** Approved  
> **Created:** January 2026  
> **Location:** `apps/tui/`

---

## Overview

**Goal:** Interactive terminal UI for managing local clones, analyses, and skills - launched with `ow` (no args).

**Design Inspiration:**

- **lazygit**: Panel-based layout, vim keybindings, status bar with keybind hints
- **btop**: Section headers, colored status indicators, responsive design

**Framework:** OpenTUI (React reconciler with Yoga layout)

---

## Key Decisions

| Decision         | Choice                    | Rationale                        |
| ---------------- | ------------------------- | -------------------------------- |
| TUI entry point  | Integrated into `ow` CLI  | Single entry point is cleaner UX |
| Long-running ops | Spinner + disable actions | Clear feedback without blocking  |
| Selection mode   | Single selection (V1)     | Keep V1 simple                   |
| Theme            | Dark only (Nord-inspired) | Matches btop/lazygit aesthetic   |

---

## Entry Point

```bash
ow              # Launches TUI (no args, TTY required)
ow --help       # Shows CLI help
ow pull <repo>  # Direct CLI command
```

The TUI becomes the "home screen" for Offworld - a local repo/skill manager.

---

## Architecture

### Directory Structure

```
apps/tui/
├── src/
│   ├── index.ts              # Entry: createCliRenderer + App mount
│   ├── App.tsx               # Root layout + global keyboard handler
│   ├── components/
│   │   ├── Layout.tsx        # 3-panel layout wrapper
│   │   ├── Header.tsx        # ASCII logo + version
│   │   ├── StatusBar.tsx     # Keybind hints footer
│   │   ├── Sidebar/
│   │   │   ├── RepoTree.tsx  # Provider > Owner > Repo tree
│   │   │   └── TreeItem.tsx  # Individual tree node
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
│   ├── hooks/
│   │   ├── useRepos.ts       # Load repos from ~/.ow/
│   │   ├── useAnalysis.ts    # Load analysis for selected repo
│   │   ├── useActions.ts     # pull/generate/remove operations
│   │   └── useFocus.ts       # Panel focus management
│   ├── store/
│   │   └── state.ts          # Zustand store for app state
│   ├── types.ts              # TUI-specific types
│   └── theme.ts              # Color palette + border styles
├── package.json
└── tsconfig.json
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
│  ▾ github            │  Status: ● Analyzed 2h ago               │
│    ▸ tanstack        │  Commit: a1b2c3d4                        │
│      ● router      ← │  Path:   ~/ow/github/tanstack/router     │
│      ○ query         │                                          │
│    ▸ vercel          │  ┌─ SKILL.md ─────────────────────────┐  │
│      ⚠ ai            │  │ ---                                │  │
│  ▾ gitlab            │  │ name: tanstack-router-reference    │  │
│    ▸ inkscape        │  │ description: Consult cloned...     │  │
│      ● inkscape      │  │ ---                                │  │
│                      │  │                                    │  │
│                      │  │ # TanStack Router Source Reference │  │
│                      │  │                                    │  │
│                      │  │ ## Repository Structure            │  │
│                      │  └────────────────────────────────────┘  │
├──────────────────────┴──────────────────────────────────────────┤
│  [p]ull  [g]enerate  [r]emove  [/]search  [?]help  [q]uit      │
└─────────────────────────────────────────────────────────────────┘
```

### Status Indicators

| Symbol | Color                 | Meaning                          |
| ------ | --------------------- | -------------------------------- |
| `●`    | Green (`#a3be8c`)     | Analyzed, up-to-date             |
| `⚠`    | Yellow (`#ebcb8b`)    | Analyzed, stale (commits behind) |
| `○`    | Dim white (`#4c566a`) | Not analyzed                     |
| `▸`    | Default               | Collapsed group                  |
| `▾`    | Default               | Expanded group                   |

### Color Palette (Nord-inspired)

```typescript
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
import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useStore } from "./store/state";
import { Header } from "./components/Header";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar/RepoTree";
import { MainPanel } from "./components/MainPanel/RepoDetail";
import { StatusBar } from "./components/StatusBar";
import { HelpModal } from "./components/Modals/HelpModal";
import { ActionMenu } from "./components/Modals/ActionMenu";

export const App = () => {
	const { activePanel, setActivePanel, modal, setModal } = useStore();

	useKeyboard((e) => {
		if (modal) return; // Let modal handle keys

		switch (e.name) {
			case "tab":
				setActivePanel(activePanel === "sidebar" ? "main" : "sidebar");
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
				<Sidebar focused={activePanel === "sidebar"} />
				<MainPanel focused={activePanel === "main"} />
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

interface TreeNode {
	id: string;
	type: "provider" | "owner" | "repo";
	name: string;
	expanded?: boolean;
	children?: TreeNode[];
	status?: "analyzed" | "stale" | "none";
	commitsBehind?: number;
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
			case "return":
				const item = flatList[cursor];
				if (item.type === "repo") {
					selectRepo(item.id);
				} else {
					toggleExpanded(item.id);
				}
				break;
			case "h":
			case "left":
				const current = flatList[cursor];
				if (current.type !== "provider") {
					toggleExpanded(current.id);
				}
				break;
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
function buildTree(repos: RepoInfo[]): TreeNode[] {
	const providers: Record<string, Record<string, TreeNode[]>> = {};

	for (const repo of repos) {
		const [provider, owner, name] = parseQualifiedName(repo.qualifiedName);
		providers[provider] ??= {};
		providers[provider][owner] ??= [];
		providers[provider][owner].push({
			id: repo.qualifiedName,
			type: "repo",
			name,
			status: repo.analyzed ? (repo.stale ? "stale" : "analyzed") : "none",
			commitsBehind: repo.commitsBehind,
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
import { formatRelative } from "../../utils";

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
				{/* Header info */}
				<box marginBottom={1}>
					<StatusBadge status={repo.analyzed ? (repo.stale ? "stale" : "analyzed") : "none"} />
					{repo.commitsBehind && (
						<text fg={colors.warning}> ({repo.commitsBehind} commits behind)</text>
					)}
				</box>

				{repo.analyzedAt && (
					<text fg={colors.fgDim}>Analyzed: {formatRelative(repo.analyzedAt)}</text>
				)}
				{repo.commitSha && <text fg={colors.fgDim}>Commit: {repo.commitSha.slice(0, 8)}</text>}
				<text fg={colors.fgDim}>Path: {repo.localPath}</text>

				{/* Skill preview */}
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
import { getAnalysisPath } from "@offworld/sdk";
import { colors } from "../../theme";

export const SkillPreview = ({ repo }: { repo: RepoInfo }) => {
	const [content, setContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const loadSkill = async () => {
			setLoading(true);
			try {
				const analysisPath = getAnalysisPath(repo.qualifiedName);
				const skillPath = `${analysisPath}/SKILL.md`;
				const text = await Bun.file(skillPath).text();
				setContent(text);
			} catch {
				setContent(null);
			} finally {
				setLoading(false);
			}
		};
		loadSkill();
	}, [repo.qualifiedName]);

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
				<text fg={colors.fgDim}>No skill file generated</text>
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
		{ name: "Pull", description: "Clone/sync and get analysis", value: "pull", key: "p" },
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

```typescript
// store/state.ts
import { create } from "zustand";
import { listRepos, getAnalysisPath } from "@offworld/sdk";
import type { RepoInfo } from "@offworld/types";

interface TUIState {
	// Data
	repos: RepoInfo[];
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
	expandedNodes: new Set(["github"]), // Default expand github
	activePanel: "sidebar",
	modal: null,
	loading: false,
	error: null,

	// Actions
	loadRepos: async () => {
		set({ loading: true, error: null });
		try {
			const repos = await listRepos();
			// Enrich with analysis metadata
			const enriched = await Promise.all(repos.map(enrichRepo));
			set({ repos: enriched, loading: false });
		} catch (e) {
			set({ error: e.message, loading: false });
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
		const { selectedRepo, loadRepos } = get();
		if (!selectedRepo) return;

		set({ loading: true, error: null });
		try {
			const { execa } = await import("execa");
			const [provider, owner, repo] = selectedRepo.split(/[:\/]/);
			const fullName = `${owner}/${repo}`;

			switch (action) {
				case "pull":
					await execa("ow", ["pull", fullName]);
					break;
				case "generate":
					await execa("ow", ["generate", fullName, "--force"]);
					break;
				case "remove":
					await execa("ow", ["rm", fullName, "-y"]);
					break;
			}

			await loadRepos(); // Refresh
		} catch (e) {
			set({ error: e.message });
		} finally {
			set({ loading: false });
		}
	},
}));

// Helper to enrich repo with analysis metadata
async function enrichRepo(repo: RepoInfo): Promise<RepoInfo> {
	try {
		const analysisPath = getAnalysisPath(repo.qualifiedName);
		const metaPath = `${analysisPath}/meta.json`;
		const meta = await Bun.file(metaPath).json();
		return {
			...repo,
			analyzed: true,
			analyzedAt: meta.analyzedAt,
			commitSha: meta.commitSha,
			// TODO: check staleness against current HEAD
		};
	} catch {
		return { ...repo, analyzed: false };
	}
}
```

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
| `o`     | Open in editor     |
| `Enter` | Open action menu   |

---

## CLI Integration

### Entry Point Modification

```typescript
// apps/cli/src/cli.ts
import { createOwCli } from "./index";

const args = process.argv.slice(2);

// Launch TUI if no args and in TTY
if (args.length === 0 && process.stdout.isTTY) {
	const { launchTUI } = await import("@offworld/tui");
	await launchTUI();
} else {
	createOwCli().run();
}
```

### TUI Entry

```typescript
// apps/tui/src/index.ts
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"
import { useStore } from "./store/state"

export async function launchTUI() {
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  // Load initial data
  await useStore.getState().loadRepos()

  // Mount React app
  createRoot(renderer).render(<App />)
}
```

---

## Dependencies

```json
{
	"name": "@offworld/tui",
	"version": "0.1.0",
	"type": "module",
	"main": "src/index.ts",
	"dependencies": {
		"@offworld/sdk": "workspace:*",
		"@offworld/types": "workspace:*",
		"@opentui/core": "^0.1.0",
		"@opentui/react": "^0.1.0",
		"react": "^19.0.0",
		"zustand": "^5.0.0",
		"execa": "^9.6.1"
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

- [ ] Set up `apps/tui/` with OpenTUI React
- [ ] Create `theme.ts` with colors/borders
- [ ] Build `Panel` component (bordered box with title)
- [ ] Build `Header` with ASCIIFont logo
- [ ] Build `StatusBar` with keybind hints
- [ ] Create 3-panel `Layout` component
- [ ] Wire up global keyboard handler

**Deliverable:** Empty layout with panels, header, statusbar renders correctly

### Phase 2: Data Layer

**Tasks:**

- [ ] Create Zustand store for state
- [ ] Implement `useRepos` hook (SDK integration)
- [ ] Implement `useAnalysis` hook (load analysis files)
- [ ] Build repo tree data structure
- [ ] Add loading/error states

**Deliverable:** TUI loads and displays repo list from `~/.ow/`

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
- [ ] Implement `executeAction` in store (pull/generate/remove)
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

- [ ] TUI launches in <500ms
- [ ] All repos visible and navigable
- [ ] Pull/Generate/Remove work from TUI
- [ ] SKILL.md preview renders correctly
- [ ] No crashes on edge cases (empty state, missing files)
- [ ] Works in 80x24 minimum terminal size
- [ ] Keyboard-only navigation (no mouse required)

---

_Created: January 2026_
