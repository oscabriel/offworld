# Offworld PRD Items

```json
{
  "project": "offworld",
  "version": "0.1.0",
  "items": [
    {
      "id": "1.1",
      "category": "Phase 1: Monorepo Setup",
      "description": "Create apps/cli directory with package.json",
      "steps_to_verify": [
        "Directory apps/cli/ exists",
        "apps/cli/package.json exists with name '@offworld/cli'",
        "Package has bin field pointing to dist/cli.mjs",
        "bun install succeeds in monorepo root"
      ],
      "passes": true
    },
    {
      "id": "1.2",
      "category": "Phase 1: Monorepo Setup",
      "description": "Create packages/sdk directory with package.json",
      "steps_to_verify": [
        "Directory packages/sdk/ exists",
        "packages/sdk/package.json exists with name '@offworld/sdk'",
        "Package is marked as private: true",
        "Has workspace dependency on @offworld/types"
      ],
      "passes": true
    },
    {
      "id": "1.3",
      "category": "Phase 1: Monorepo Setup",
      "description": "Create packages/types directory with package.json",
      "steps_to_verify": [
        "Directory packages/types/ exists",
        "packages/types/package.json exists with name '@offworld/types'",
        "Has zod as dependency using catalog:",
        "Exports both '.' and './schemas' entry points"
      ],
      "passes": true
    },
    {
      "id": "1.4",
      "category": "Phase 1: Monorepo Setup",
      "description": "Create packages/plugin directory with package.json",
      "steps_to_verify": [
        "Directory packages/plugin/ exists",
        "packages/plugin/package.json exists with name '@offworld/plugin'",
        "Has workspace dependencies on @offworld/sdk and @offworld/types"
      ],
      "passes": true
    },
    {
      "id": "2.1",
      "category": "Phase 2: Types Package",
      "description": "Implement ConfigSchema for CLI configuration",
      "steps_to_verify": [
        "packages/types/src/schemas.ts exports ConfigSchema",
        "Schema includes repoRoot with default ~/ow",
        "Schema includes metaRoot with default ~/.ow",
        "Schema includes skillDir with default ~/.config/opencode/skill",
        "Schema includes defaultShallow boolean",
        "Schema includes autoAnalyze boolean"
      ],
      "passes": true
    },
    {
      "id": "2.2",
      "category": "Phase 2: Types Package",
      "description": "Implement GitProvider and RepoSource schemas",
      "steps_to_verify": [
        "GitProviderSchema is enum of 'github', 'gitlab', 'bitbucket'",
        "RemoteRepoSourceSchema has type, provider, owner, repo, fullName, qualifiedName, cloneUrl",
        "LocalRepoSourceSchema has type, path, name, qualifiedName",
        "RepoSourceSchema is discriminatedUnion on 'type' field"
      ],
      "passes": true
    },
    {
      "id": "2.3",
      "category": "Phase 2: Types Package",
      "description": "Implement Architecture and Entity schemas",
      "steps_to_verify": [
        "ProjectTypeSchema is enum: monorepo, library, cli, app, framework",
        "EntityTypeSchema is enum: package, module, feature, util, config",
        "EntitySchema has name, type, path, description, responsibilities, exports, dependencies",
        "ArchitectureSchema has projectType, entities, relationships, keyFiles, patterns"
      ],
      "passes": true
    },
    {
      "id": "2.4",
      "category": "Phase 2: Types Package",
      "description": "Implement FileIndex and AnalysisMeta schemas",
      "steps_to_verify": [
        "FileRoleSchema is enum: entry, core, types, config, test, util, doc",
        "FileIndexEntrySchema has path, importance (0-1), type, optional exports/imports/summary",
        "FileIndexSchema is array of FileIndexEntrySchema",
        "AnalysisMetaSchema has analyzedAt, commitSha, version, optional tokenCost"
      ],
      "passes": true
    },
    {
      "id": "2.5",
      "category": "Phase 2: Types Package",
      "description": "Implement Skill schema for SKILL.md generation",
      "steps_to_verify": [
        "SkillSchema has name, description, allowedTools array",
        "SkillSchema has repositoryStructure array with path and purpose",
        "SkillSchema has keyFiles array with path and description",
        "SkillSchema has searchStrategies array of strings",
        "SkillSchema has whenToUse array of strings"
      ],
      "passes": true
    },
    {
      "id": "2.6",
      "category": "Phase 2: Types Package",
      "description": "Export inferred TypeScript types from schemas",
      "steps_to_verify": [
        "packages/types/src/types.ts exports Config type",
        "packages/types/src/types.ts exports RepoSource type",
        "packages/types/src/types.ts exports Architecture type",
        "packages/types/src/types.ts exports Skill type",
        "packages/types/src/index.ts re-exports all schemas and types",
        "bun run build succeeds in packages/types"
      ],
      "passes": true
    },
    {
      "id": "3.1",
      "category": "Phase 3: SDK Core",
      "description": "Implement config.ts for path utilities and config loading",
      "steps_to_verify": [
        "getMetaRoot() returns ~/.ow",
        "getRepoRoot() returns configured root or ~/ow default",
        "getRepoPath(fullName) returns correct path for owner/repo",
        "getAnalysisPath(fullName) returns ~/.ow/analyses/{owner}--{repo}",
        "loadConfig() reads ~/.ow/config.json or returns defaults",
        "saveConfig() writes validated config to ~/.ow/config.json"
      ],
      "passes": true
    },
    {
      "id": "3.2",
      "category": "Phase 3: SDK Core",
      "description": "Implement repo-source.ts for input parsing",
      "steps_to_verify": [
        "parseRepoInput('tanstack/router') returns github remote source",
        "parseRepoInput('https://github.com/tanstack/router') returns github remote source",
        "parseRepoInput('git@github.com:tanstack/router.git') returns github remote source",
        "parseRepoInput('https://gitlab.com/owner/repo') returns gitlab remote source",
        "parseRepoInput('.') returns local source with path hash",
        "parseRepoInput('/abs/path') returns local source if .git exists",
        "Throws error for non-existent paths",
        "Throws error for non-git directories"
      ],
      "passes": true
    },
    {
      "id": "3.3",
      "category": "Phase 3: SDK Core",
      "description": "Implement clone.ts for git operations",
      "steps_to_verify": [
        "cloneRepo(fullName) clones to ~/ow/{provider}/{owner}/{repo}",
        "cloneRepo with shallow option uses --depth 1",
        "cloneRepo with branch option uses --branch flag",
        "cloneRepo throws if repo already exists",
        "updateRepo(fullName) runs git fetch and pull",
        "removeRepo(fullName) deletes both repo and analysis directories",
        "listRepos() returns all repos from index"
      ],
      "passes": true
    },
    {
      "id": "3.4",
      "category": "Phase 3: SDK Core",
      "description": "Implement constants.ts with ignore patterns",
      "steps_to_verify": [
        "DEFAULT_IGNORE_PATTERNS includes node_modules, dist, build, .git",
        "DEFAULT_IGNORE_PATTERNS includes binary extensions (jpg, png, mp4, etc)",
        "DEFAULT_IGNORE_PATTERNS includes IDE directories (.vscode, .idea)",
        "SUPPORTED_LANGUAGES includes typescript, javascript, python, go, rust",
        "VERSION constant matches package version"
      ],
      "passes": true
    },
    {
      "id": "3.5",
      "category": "Phase 3: SDK Core",
      "description": "Implement util.ts with helper functions",
      "steps_to_verify": [
        "isBinaryBuffer() returns true for buffers with null bytes",
        "isBinaryBuffer() returns true for high ratio of suspicious bytes",
        "isBinaryBuffer() returns false for text content",
        "hashBuffer() returns sha256 hex string",
        "loadGitignorePatterns() parses .gitignore and returns glob patterns",
        "loadGitignorePatterns() handles negation patterns with !",
        "loadGitignorePatterns() returns empty array if no .gitignore"
      ],
      "passes": true
    },
    {
      "id": "3.6",
      "category": "Phase 3: SDK Core",
      "description": "Implement index-manager.ts for global repo index",
      "steps_to_verify": [
        "getIndex() reads ~/.ow/index.json or returns empty",
        "updateIndex() adds/updates repo entry in index",
        "saveIndex() writes index to ~/.ow/index.json",
        "Index entries have fullName, localPath, analyzedAt, commitSha, hasSkill"
      ],
      "passes": true
    },
    {
      "id": "3.7",
      "category": "Phase 3: SDK File Importance",
      "description": "Implement Tree-sitter parser setup",
      "steps_to_verify": [
        "packages/sdk/src/importance/parser.ts initializes Tree-sitter",
        "Supports TypeScript/JavaScript parser",
        "Supports Python parser",
        "Supports Go parser",
        "getLanguage(ext) maps file extensions to parsers"
      ],
      "passes": true
    },
    {
      "id": "3.8",
      "category": "Phase 3: SDK File Importance",
      "description": "Implement import extraction queries",
      "steps_to_verify": [
        "packages/sdk/src/importance/queries.ts has TS/JS import query",
        "packages/sdk/src/importance/queries.ts has Python import query",
        "packages/sdk/src/importance/queries.ts has Go import query",
        "extractImports(content, lang) returns array of module names"
      ],
      "passes": true
    },
    {
      "id": "3.9",
      "category": "Phase 3: SDK File Importance",
      "description": "Implement rankFileImportance algorithm",
      "steps_to_verify": [
        "rankFileImportance(repoPath) discovers files respecting ignore patterns",
        "Builds import graph by parsing each file",
        "Scores files by inbound import count",
        "Returns FileIndexEntry[] sorted by importance descending",
        "Skips binary files",
        "Respects .gitignore patterns"
      ],
      "passes": true
    },
    {
      "id": "3.10",
      "category": "Phase 3: SDK AI Provider",
      "description": "Implement AI provider detection",
      "steps_to_verify": [
        "packages/sdk/src/ai/provider.ts exports detectProvider()",
        "Checks config.preferredProvider first if set",
        "Falls back to Claude Code detection via 'claude --version'",
        "Falls back to OpenCode detection via localhost:4096/health",
        "Throws AIProviderNotFoundError with install instructions if neither found"
      ],
      "passes": true
    },
    {
      "id": "3.11",
      "category": "Phase 3: SDK AI Provider",
      "description": "Implement Claude Code SDK wrapper",
      "steps_to_verify": [
        "packages/sdk/src/ai/claude-code.ts exports analyzeWithClaudeCode()",
        "Uses @anthropic-ai/claude-agent-sdk query function",
        "Sets allowedTools to Read, Glob, Grep",
        "Uses bypassPermissions mode",
        "Supports outputFormat with json_schema from Zod",
        "Returns structured_output from result message"
      ],
      "passes": true
    },
    {
      "id": "3.12",
      "category": "Phase 3: SDK AI Provider",
      "description": "Implement OpenCode SDK wrapper",
      "steps_to_verify": [
        "packages/sdk/src/ai/opencode.ts exports analyzeWithOpenCode()",
        "Creates client pointing to localhost:4096",
        "Creates session with appropriate agent and model",
        "Sends prompt and parses response with Zod schema"
      ],
      "passes": true
    },
    {
      "id": "3.13",
      "category": "Phase 3: SDK AI Provider",
      "description": "Implement unified AI interface",
      "steps_to_verify": [
        "packages/sdk/src/ai/index.ts exports runAnalysis()",
        "runAnalysis() calls detectProvider() first",
        "Routes to appropriate provider based on detection",
        "Returns validated result from Zod schema"
      ],
      "passes": true
    },
    {
      "id": "3.14",
      "category": "Phase 3: SDK Sync",
      "description": "Implement sync.ts for CLI-Convex communication",
      "steps_to_verify": [
        "pullAnalysis(fullName) fetches from /api/analyses/pull",
        "pushAnalysis(fullName, token) posts to /api/analyses/push with Bearer auth",
        "checkRemote(fullName) checks /api/analyses/check for existence",
        "checkStaleness() compares local vs remote commit SHA",
        "canPushToWeb() rejects local repos",
        "canPushToWeb() rejects non-GitHub repos (V1)",
        "canPushToWeb() checks GitHub stars, requires 5+"
      ],
      "passes": true
    },
    {
      "id": "4.1",
      "category": "Phase 4: CLI Setup",
      "description": "Create CLI package structure with tsdown",
      "steps_to_verify": [
        "apps/cli/package.json has correct dependencies",
        "apps/cli/tsdown.config.ts configured for ESM output",
        "apps/cli/src/cli.ts is entry point with shebang",
        "bun run build succeeds in apps/cli",
        "Output has executable permission"
      ],
      "passes": true
    },
    {
      "id": "4.2",
      "category": "Phase 4: CLI Setup",
      "description": "Implement CLI router with trpc-cli + @orpc/server",
      "steps_to_verify": [
        "apps/cli/src/index.ts exports router using @orpc/server os.router()",
        "Router has clone command as default with negateBooleans meta",
        "Router has list, analyze, summary, remove commands",
        "createOwCli() uses createCli from trpc-cli",
        "CLI responds to --help flag",
        "CLI responds to --version flag"
      ],
      "passes": true
    },
    {
      "id": "4.3",
      "category": "Phase 4: CLI Commands",
      "description": "Implement 'ow pull' command",
      "steps_to_verify": [
        "Accepts owner/repo, GitHub URL, GitLab URL, local path",
        "Clones remote repo to ~/ow/{provider}/{owner}/{repo} if not exists",
        "Runs git fetch/pull if repo already exists",
        "Checks offworld.sh for existing analysis",
        "Pulls remote analysis if exists, else generates locally",
        "Installs SKILL.md to both ~/.config/opencode/skill/ and ~/.claude/skills/",
        "Completes in <2 minutes for average repo",
        "Shows progress with @clack/prompts spinner"
      ],
      "passes": true
    },
    {
      "id": "4.4",
      "category": "Phase 4: CLI Commands",
      "description": "Implement 'ow generate' command",
      "steps_to_verify": [
        "Warns and exits if remote analysis exists (unless --force)",
        "Clones repo if not already cloned",
        "Runs full analysis pipeline locally",
        "Creates summary.md in analysis directory",
        "Creates architecture.json in analysis directory",
        "Creates architecture.md with Mermaid diagrams",
        "Creates file-index.json with ranked files",
        "Creates SKILL.md and auto-installs to skill directories",
        "Creates meta.json with analyzedAt, commitSha, version",
        "Costs <$0.05 per repo"
      ],
      "passes": true
    },
    {
      "id": "4.5",
      "category": "Phase 4: CLI Commands",
      "description": "Implement 'ow push' command",
      "steps_to_verify": [
        "Requires authentication (checks for session token)",
        "Rejects local repos with clear message",
        "Rejects non-GitHub repos with 'coming soon' message",
        "Checks GitHub stars, rejects if <5",
        "Uploads analysis to offworld.sh",
        "Handles rate limit errors (3/repo/day)",
        "Handles conflict errors (newer analysis exists)"
      ],
      "passes": true
    },
    {
      "id": "4.6",
      "category": "Phase 4: CLI Commands",
      "description": "Implement 'ow list' command",
      "steps_to_verify": [
        "Lists all cloned repos with analysis status",
        "Shows analyzed/not analyzed indicator",
        "Shows commits behind if stale",
        "-p flag shows full paths",
        "--stale flag filters to stale repos only",
        "--json flag outputs machine-readable JSON"
      ],
      "passes": true
    },
    {
      "id": "4.7",
      "category": "Phase 4: CLI Commands",
      "description": "Implement 'ow rm' command",
      "steps_to_verify": [
        "Prompts for confirmation before deletion",
        "-y flag skips confirmation",
        "Removes repo directory from ~/ow/",
        "Removes analysis directory from ~/.ow/analyses/",
        "--keep-skill flag preserves installed skill files",
        "--dry-run flag shows what would be deleted",
        "Updates global index after removal"
      ],
      "passes": true
    },
    {
      "id": "4.8",
      "category": "Phase 4: CLI Commands",
      "description": "Implement 'ow auth' subcommands",
      "steps_to_verify": [
        "'ow auth login' opens browser to offworld.sh/login",
        "'ow auth login' stores session token after OAuth callback",
        "'ow auth logout' clears stored session",
        "'ow auth status' shows current login state"
      ],
      "passes": true
    },
    {
      "id": "4.9",
      "category": "Phase 4: CLI Commands",
      "description": "Implement 'ow config' subcommands",
      "steps_to_verify": [
        "'ow config' shows all current settings",
        "'ow config set root /custom/path' updates repoRoot",
        "'ow config get root' returns current value",
        "'ow config reset' restores defaults",
        "'ow config path' shows config file location",
        "--json flag outputs as JSON"
      ],
      "passes": true
    },
    {
      "id": "5.1",
      "category": "Phase 5: Analysis Pipeline",
      "description": "Implement context gathering for AI prompts",
      "steps_to_verify": [
        "gatherContext() reads README.md (truncated to ~500 tokens)",
        "gatherContext() reads package.json or equivalent config",
        "gatherContext() builds file tree from important files",
        "gatherContext() reads content of top 10-20 files by importance",
        "Total context stays within ~3500-4000 token budget"
      ],
      "passes": true
    },
    {
      "id": "5.2",
      "category": "Phase 5: Analysis Pipeline",
      "description": "Implement summary generation",
      "steps_to_verify": [
        "generateSummary() calls AI with context and summary prompt",
        "Output is markdown describing project purpose",
        "Output includes key features and technologies",
        "Output saved to ~/.ow/analyses/{repo}/summary.md"
      ],
      "passes": true
    },
    {
      "id": "5.3",
      "category": "Phase 5: Analysis Pipeline",
      "description": "Implement architecture extraction",
      "steps_to_verify": [
        "extractArchitecture() uses generateObject with ArchitectureSchema",
        "Output includes projectType classification",
        "Output includes entities with responsibilities and exports",
        "Output includes relationships between entities",
        "Output includes keyFiles with roles",
        "Output includes detected patterns (framework, buildTool, etc)",
        "JSON saved to ~/.ow/analyses/{repo}/architecture.json"
      ],
      "passes": true
    },
    {
      "id": "5.4",
      "category": "Phase 5: Analysis Pipeline",
      "description": "Implement architecture.md with Mermaid diagrams",
      "steps_to_verify": [
        "formatArchitectureMd() converts architecture.json to markdown",
        "Includes Mermaid flowchart of entity relationships",
        "Includes table of key files and their roles",
        "Includes summary of detected patterns",
        "Saved to ~/.ow/analyses/{repo}/architecture.md"
      ],
      "passes": true
    },
    {
      "id": "5.5",
      "category": "Phase 5: Analysis Pipeline",
      "description": "Implement SKILL.md generation",
      "steps_to_verify": [
        "generateSkill() uses generateObject with SkillSchema",
        "formatSkillMd() produces valid YAML frontmatter",
        "Frontmatter includes name, description, allowed-tools",
        "Body includes Repository Structure section",
        "Body includes Quick Reference Paths (5-10 key files)",
        "Body includes Search Strategies with grep patterns",
        "Body includes When to Use section with trigger conditions",
        "Skill is usable without manual editing"
      ],
      "passes": true
    },
    {
      "id": "5.6",
      "category": "Phase 5: Analysis Pipeline",
      "description": "Implement skill auto-installation",
      "steps_to_verify": [
        "installSkill() creates ~/.config/opencode/skill/{repo}/SKILL.md",
        "installSkill() creates ~/.claude/skills/{repo}/SKILL.md",
        "Both directories created if they don't exist",
        "Existing skills are overwritten on re-analysis"
      ],
      "passes": true
    },
    {
      "id": "6.1",
      "category": "Phase 6: OpenCode Plugin",
      "description": "Create plugin package structure",
      "steps_to_verify": [
        "packages/plugin/package.json has @opencode-ai/plugin dependency",
        "packages/plugin/src/index.ts exports OffworldPlugin",
        "Plugin implements Plugin type from @opencode-ai/plugin",
        "bun run build succeeds in packages/plugin"
      ],
      "passes": true
    },
    {
      "id": "6.2",
      "category": "Phase 6: OpenCode Plugin",
      "description": "Implement offworld tool with modes",
      "steps_to_verify": [
        "Tool has mode arg: list, summary, architecture, clone",
        "mode='list' returns all cloned repos",
        "mode='summary' returns summary.md content for given repo",
        "mode='architecture' returns architecture.json for given repo",
        "mode='clone' triggers clone and analysis for repo"
      ],
      "passes": true
    },
    {
      "id": "6.3",
      "category": "Phase 6: OpenCode Plugin",
      "description": "Implement context injection hook",
      "steps_to_verify": [
        "Plugin implements experimental.chat.system.transform hook",
        "Injects [OFFWORLD] with list of cloned repos into system prompt",
        "Only injects if repos exist",
        "Injection is synthetic (not shown to user)"
      ],
      "passes": true
    },
    {
      "id": "7.1",
      "category": "Phase 7: Backend Schema",
      "description": "Update Convex schema for analyses",
      "steps_to_verify": [
        "packages/backend/convex/schema.ts has analyses table",
        "analyses table has fullName, summary, architecture, skill, commitSha, analyzedAt",
        "analyses table has pullCount, isVerified fields",
        "analyses table has index by_fullName",
        "analyses table has index by_pullCount",
        "pushLogs table exists for rate limiting",
        "pushLogs table has index by_repo_date"
      ],
      "passes": true
    },
    {
      "id": "7.2",
      "category": "Phase 7: Backend HTTP Actions",
      "description": "Implement /api/analyses/pull endpoint",
      "steps_to_verify": [
        "packages/backend/convex/http.ts routes POST /api/analyses/pull",
        "Returns 400 if fullName missing",
        "Returns 404 if analysis not found",
        "Returns analysis JSON if found",
        "Increments pullCount on successful pull"
      ],
      "passes": true
    },
    {
      "id": "7.3",
      "category": "Phase 7: Backend HTTP Actions",
      "description": "Implement /api/analyses/push endpoint",
      "steps_to_verify": [
        "packages/backend/convex/http.ts routes POST /api/analyses/push",
        "Returns 401 if no Authorization header",
        "Returns 401 if session token invalid",
        "Returns 400 if required fields missing",
        "Returns 400 if rate limited (3/repo/day)",
        "Returns 400 if pushing older analysis over newer",
        "Returns 400 if different analysis for same commit",
        "Creates or updates analysis on success"
      ],
      "passes": true
    },
    {
      "id": "7.4",
      "category": "Phase 7: Backend HTTP Actions",
      "description": "Implement /api/analyses/check endpoint",
      "steps_to_verify": [
        "packages/backend/convex/http.ts routes POST /api/analyses/check",
        "Returns { exists: false } if not found",
        "Returns { exists: true, commitSha, analyzedAt } if found",
        "Does not increment pullCount (lightweight check)"
      ],
      "passes": true
    },
    {
      "id": "7.5",
      "category": "Phase 7: Backend Functions",
      "description": "Implement internal Convex functions",
      "steps_to_verify": [
        "packages/backend/convex/analyses.ts has getByRepo internalQuery",
        "packages/backend/convex/analyses.ts has getMeta internalQuery",
        "packages/backend/convex/analyses.ts has incrementPullCount internalMutation",
        "packages/backend/convex/analyses.ts has upsert internalMutation",
        "upsert enforces rate limiting logic",
        "upsert enforces conflict resolution logic"
      ],
      "passes": true
    },
    {
      "id": "7.6",
      "category": "Phase 7: Web App",
      "description": "Add analysis display page",
      "steps_to_verify": [
        "Route /repo/{owner}/{repo} exists",
        "Page displays summary.md content",
        "Page displays architecture diagram",
        "Page shows GitHub stars (live from API)",
        "Page shows analysis date and commit SHA",
        "Page shows pull count"
      ],
      "passes": true
    },
    {
      "id": "7.7",
      "category": "Phase 7: Web App",
      "description": "Add copy skill command button",
      "steps_to_verify": [
        "Repo page has 'Copy command' button",
        "Button copies 'bunx @offworld/cli pull {owner}/{repo}' to clipboard",
        "Toast notification confirms copy",
        "Command works when pasted in terminal"
      ],
      "passes": true
    },
    {
      "id": "7.8",
      "category": "Phase 7: Web App",
      "description": "Add repo directory/browse page",
      "steps_to_verify": [
        "Route / or /browse shows list of analyzed repos",
        "Repos sorted by pull count (popularity)",
        "Each repo shows name, stars, analysis date",
        "Search/filter functionality works",
        "Clicking repo navigates to detail page"
      ],
      "passes": true
    },
    {
      "id": "8.1",
      "category": "Phase 8: Distribution",
      "description": "Set up GitHub release workflow",
      "steps_to_verify": [
        ".github/workflows/release.yml exists",
        "Triggers on tag push (v*)",
        "Builds binaries for darwin-arm64, darwin-x64, linux-arm64, linux-x64",
        "Creates tar.gz archives",
        "Generates checksums.txt",
        "Creates GitHub release with assets"
      ],
      "passes": true
    },
    {
      "id": "8.2",
      "category": "Phase 8: Distribution",
      "description": "Set up curl install script",
      "steps_to_verify": [
        "apps/web/public/install script exists",
        "Script detects OS and architecture",
        "Script downloads correct binary from GitHub releases",
        "Script verifies checksum",
        "Script installs to ~/.local/bin/ow",
        "Script prompts to add to PATH if needed",
        "https://offworld.sh/install serves the script"
      ],
      "passes": true
    },
    {
      "id": "8.3",
      "category": "Phase 8: Distribution",
      "description": "Set up Homebrew tap",
      "steps_to_verify": [
        "oscabriel/homebrew-tap repository exists",
        "Formula/ow.rb exists with correct structure",
        "Formula handles darwin-arm64, darwin-x64, linux-arm64, linux-x64",
        "'brew install oscabriel/tap/ow' works",
        "Release workflow auto-updates formula checksums"
      ],
      "passes": false
    },
    {
      "id": "8.4",
      "category": "Phase 8: Distribution",
      "description": "Set up npm publishing",
      "steps_to_verify": [
        "apps/cli/package.json has name 'offworld' (not scoped)",
        "Package has correct files array",
        "prepublishOnly script runs build",
        "'npm install -g offworld' works",
        "Release workflow auto-publishes to npm"
      ],
      "passes": true
    },
    {
      "id": "9.1",
      "category": "Phase 9: Quality Gates",
      "description": "CLI installs in under 30 seconds",
      "steps_to_verify": [
        "Time 'curl -fsSL https://offworld.sh/install | bash' < 30s",
        "Time 'brew install oscabriel/tap/ow' < 30s",
        "Time 'npm install -g offworld' < 30s"
      ],
      "passes": false
    },
    {
      "id": "9.2",
      "category": "Phase 9: Quality Gates",
      "description": "'ow pull' completes in under 2 minutes",
      "steps_to_verify": [
        "Time 'ow pull tanstack/router' on fresh install < 2 minutes",
        "Time 'ow pull vercel/ai' on fresh install < 2 minutes",
        "Subsequent pulls (with existing clone) complete in < 30 seconds"
      ],
      "passes": false
    },
    {
      "id": "9.3",
      "category": "Phase 9: Quality Gates",
      "description": "Analysis costs under $0.05 per repo",
      "steps_to_verify": [
        "Track token usage during analysis",
        "Calculate cost based on Claude Sonnet pricing",
        "Average cost across 10 repos < $0.05"
      ],
      "passes": false
    },
    {
      "id": "9.4",
      "category": "Phase 9: Quality Gates",
      "description": "Generated SKILL.md is usable without editing",
      "steps_to_verify": [
        "Generate skill for tanstack/router",
        "Load skill in Claude Code or OpenCode",
        "Ask agent question about repo",
        "Agent successfully uses skill to find answer",
        "No manual editing of SKILL.md required"
      ],
      "passes": false
    },
    {
      "id": "T2.1",
      "category": "Tests: Types Package",
      "description": "Unit tests for Zod schema validation",
      "steps_to_verify": [
        "packages/types/src/__tests__/schemas.test.ts exists",
        "ConfigSchema validates valid config objects",
        "ConfigSchema rejects invalid config (wrong types)",
        "ConfigSchema applies defaults correctly",
        "RepoSourceSchema discriminates remote vs local correctly",
        "GitProviderSchema only accepts github/gitlab/bitbucket",
        "ArchitectureSchema validates complete architecture object",
        "SkillSchema validates skill with all required fields",
        "FileIndexEntrySchema validates importance is 0-1 range",
        "All tests pass with 'bun test' in packages/types"
      ],
      "passes": true
    },
    {
      "id": "T3.1",
      "category": "Tests: SDK Config",
      "description": "Unit tests for config.ts path utilities",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/config.test.ts exists",
        "getMetaRoot() returns path ending in .ow",
        "getRepoRoot() returns default ~/ow when no config",
        "getRepoRoot() returns custom path when configured",
        "getRepoPath('owner/repo') returns {root}/github/owner/repo",
        "getAnalysisPath('owner/repo') returns {meta}/analyses/github--owner--repo",
        "loadConfig() returns defaults when config file missing",
        "loadConfig() parses existing config file correctly",
        "saveConfig() creates directory if missing",
        "saveConfig() merges with existing config",
        "All tests pass with 'bun test' in packages/sdk"
      ],
      "passes": true
    },
    {
      "id": "T3.2",
      "category": "Tests: SDK Repo Source",
      "description": "Unit tests for repo-source.ts input parsing",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/repo-source.test.ts exists",
        "parseRepoInput('owner/repo') returns github remote with correct fields",
        "parseRepoInput('https://github.com/o/r') extracts owner and repo",
        "parseRepoInput('https://github.com/o/r.git') handles .git suffix",
        "parseRepoInput('git@github.com:o/r.git') parses SSH URL",
        "parseRepoInput('https://gitlab.com/o/r') returns gitlab provider",
        "parseRepoInput('https://bitbucket.org/o/r') returns bitbucket provider",
        "parseRepoInput('.') returns local source (mocked fs)",
        "parseRepoInput('/path') returns local with hashed qualifiedName",
        "parseRepoInput throws for non-existent path",
        "parseRepoInput throws for directory without .git",
        "qualifiedName format is 'provider:owner/repo' for remote",
        "qualifiedName format is 'local:hash' for local",
        "getAnalysisPathForSource() sanitizes qualifiedName correctly"
      ],
      "passes": true
    },
    {
      "id": "T3.3",
      "category": "Tests: SDK Utilities",
      "description": "Unit tests for util.ts helper functions",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/util.test.ts exists",
        "isBinaryBuffer() returns true for buffer with null bytes",
        "isBinaryBuffer() returns true for buffer with >30% suspicious bytes",
        "isBinaryBuffer() returns false for UTF-8 text buffer",
        "isBinaryBuffer() returns false for empty buffer",
        "hashBuffer() returns 64-char hex string",
        "hashBuffer() returns consistent hash for same input",
        "hashBuffer() returns different hash for different input",
        "loadGitignorePatterns() returns empty array for missing file",
        "loadGitignorePatterns() parses simple patterns",
        "loadGitignorePatterns() handles comments (# lines)",
        "loadGitignorePatterns() handles negation (!pattern)",
        "loadGitignorePatterns() converts directory patterns (dir/)",
        "loadGitignorePatterns() handles root-relative patterns (/pattern)"
      ],
      "passes": true
    },
    {
      "id": "T3.4",
      "category": "Tests: SDK Clone",
      "description": "Unit tests for clone.ts git operations",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/clone.test.ts exists",
        "cloneRepo() calls git clone with correct URL (mocked execa)",
        "cloneRepo() uses --depth 1 when shallow=true",
        "cloneRepo() uses --branch flag when branch specified",
        "cloneRepo() throws RepoExistsError if path exists",
        "cloneRepo() creates parent directories if missing",
        "cloneRepo() updates index after successful clone",
        "updateRepo() calls git fetch then git pull",
        "updateRepo() throws RepoNotFoundError if not cloned",
        "removeRepo() removes repo directory",
        "removeRepo() removes analysis directory",
        "removeRepo() updates index after removal",
        "listRepos() returns repos from index"
      ],
      "passes": true
    },
    {
      "id": "T3.5",
      "category": "Tests: SDK Index Manager",
      "description": "Unit tests for index-manager.ts",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/index-manager.test.ts exists",
        "getIndex() returns empty index when file missing",
        "getIndex() parses existing index.json",
        "updateIndex() adds new repo entry",
        "updateIndex() updates existing repo entry",
        "saveIndex() writes valid JSON",
        "Index version field is set correctly"
      ],
      "passes": true
    },
    {
      "id": "T3.6",
      "category": "Tests: SDK File Importance",
      "description": "Unit tests for importance ranking",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/importance.test.ts exists",
        "getLanguage('.ts') returns typescript",
        "getLanguage('.js') returns javascript",
        "getLanguage('.py') returns python",
        "getLanguage('.go') returns go",
        "getLanguage('.txt') returns undefined",
        "extractImports() extracts ES6 imports from TS/JS",
        "extractImports() extracts require() calls",
        "extractImports() extracts Python import statements",
        "extractImports() extracts Go import statements",
        "rankFileImportance() scores files by import count",
        "rankFileImportance() returns sorted array (highest first)",
        "rankFileImportance() respects ignore patterns",
        "rankFileImportance() skips binary files"
      ],
      "passes": true
    },
    {
      "id": "T3.7",
      "category": "Tests: SDK AI Provider",
      "description": "Unit tests for AI provider detection",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/ai-provider.test.ts exists",
        "detectProvider() returns config preference if set and available",
        "detectProvider() falls back to claude-code if available",
        "detectProvider() falls back to opencode if claude-code unavailable",
        "detectProvider() throws AIProviderNotFoundError if neither available",
        "isClaudeCodeAvailable() checks 'claude --version' (mocked)",
        "isOpenCodeAvailable() checks localhost:4096/health (mocked fetch)"
      ],
      "passes": true
    },
    {
      "id": "T3.8",
      "category": "Tests: SDK Sync",
      "description": "Unit tests for sync.ts API communication",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/sync.test.ts exists",
        "pullAnalysis() calls correct endpoint with POST",
        "pullAnalysis() returns null on 404",
        "pullAnalysis() returns parsed analysis on success",
        "pushAnalysis() includes Authorization header",
        "pushAnalysis() sends correct JSON body",
        "pushAnalysis() returns success:true on 200",
        "pushAnalysis() returns error message on failure",
        "checkRemote() returns exists:false on 404",
        "checkRemote() returns commitSha and analyzedAt on success",
        "canPushToWeb() rejects local sources",
        "canPushToWeb() rejects non-github providers",
        "canPushToWeb() rejects repos with <5 stars (mocked GitHub API)",
        "canPushToWeb() allows repos with 5+ stars",
        "fetchRepoStars() parses GitHub API response",
        "fetchRepoStars() returns 0 on API error"
      ],
      "passes": true
    },
    {
      "id": "T4.1",
      "category": "Tests: CLI Handlers",
      "description": "Unit tests for CLI command handlers",
      "steps_to_verify": [
        "apps/cli/src/__tests__/handlers.test.ts exists",
        "pullHandler() calls cloneRepo for new repos",
        "pullHandler() calls updateRepo for existing repos",
        "pullHandler() tries remote analysis before local generation",
        "pullHandler() falls back to local generation on remote failure",
        "generateHandler() warns if remote exists (mocked)",
        "generateHandler() proceeds with --force flag",
        "generateHandler() calls full analysis pipeline",
        "pushHandler() checks authentication first",
        "pushHandler() validates canPushToWeb before upload",
        "listHandler() formats repo list correctly",
        "listHandler() outputs JSON with --json flag",
        "rmHandler() prompts for confirmation (mocked)",
        "rmHandler() skips prompt with -y flag"
      ],
      "passes": true
    },
    {
      "id": "T5.1",
      "category": "Tests: Analysis Pipeline",
      "description": "Unit tests for context gathering",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/analysis.test.ts exists",
        "gatherContext() reads README.md if exists",
        "gatherContext() truncates README to token limit",
        "gatherContext() reads package.json if exists",
        "gatherContext() builds file tree string",
        "gatherContext() includes top N files by importance",
        "gatherContext() total size is within token budget",
        "estimateTokens() approximates token count"
      ],
      "passes": true
    },
    {
      "id": "T5.2",
      "category": "Tests: Analysis Pipeline",
      "description": "Unit tests for skill formatting",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/skill.test.ts exists",
        "formatSkillMd() produces valid YAML frontmatter",
        "formatSkillMd() includes all required sections",
        "formatSkillMd() escapes special characters in YAML",
        "installSkill() creates OpenCode skill directory",
        "installSkill() creates Claude Code skill directory",
        "installSkill() writes correct content to both locations"
      ],
      "passes": true
    },
    {
      "id": "T5.3",
      "category": "Tests: Analysis Pipeline",
      "description": "Unit tests for architecture formatting",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/architecture.test.ts exists",
        "formatArchitectureMd() produces valid Mermaid syntax",
        "formatArchitectureMd() includes all entities in diagram",
        "formatArchitectureMd() includes relationships as arrows",
        "formatArchitectureMd() includes key files table",
        "formatArchitectureMd() includes patterns section"
      ],
      "passes": true
    },
    {
      "id": "T7.1",
      "category": "Tests: Backend",
      "description": "Unit tests for Convex functions",
      "steps_to_verify": [
        "packages/backend/convex/__tests__/analyses.test.ts exists",
        "getByRepo returns null for missing repo",
        "getByRepo returns analysis for existing repo",
        "getMeta returns only commitSha and analyzedAt",
        "incrementPullCount increases count by 1",
        "upsert creates new analysis when not exists",
        "upsert updates existing analysis when newer",
        "upsert rejects older analysis over newer",
        "upsert enforces rate limit (3/repo/day)",
        "upsert rejects different analysis for same commit"
      ],
      "passes": true
    },
    {
      "id": "T0.1",
      "category": "Tests: Setup",
      "description": "Configure Vitest for monorepo testing",
      "steps_to_verify": [
        "vitest is in root devDependencies",
        "vitest.config.ts exists at root or per-package",
        "packages/types has test script in package.json",
        "packages/sdk has test script in package.json",
        "apps/cli has test script in package.json",
        "'bun run test' works at monorepo root",
        "turbo.json has test task configured"
      ],
      "passes": true
    },
    {
      "id": "T0.2",
      "category": "Tests: Setup",
      "description": "Set up test fixtures and mocks",
      "steps_to_verify": [
        "packages/sdk/src/__tests__/fixtures/ directory exists",
        "Fixture for sample TypeScript file with imports",
        "Fixture for sample Python file with imports",
        "Fixture for sample .gitignore file",
        "Fixture for sample package.json",
        "Fixture for sample README.md",
        "Mock for execa (git commands)",
        "Mock for fetch (API calls)",
        "Mock for fs-extra (file system)"
      ],
      "passes": true
    }
  ]
}
```
