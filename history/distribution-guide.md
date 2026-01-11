# Offworld: Distribution Guide

> How to distribute the `ow` CLI to users via three methods.
>
> **Scaffold:** `/Users/oscargabriel/Developer/projects/offworld`

---

## Installation Methods

| Method       | Command                                          | Best For                          |
| ------------ | ------------------------------------------------ | --------------------------------- |
| **curl**     | `curl -fsSL https://offworld.sh/install \| bash` | Quick start, no package manager   |
| **Homebrew** | `brew install oscabriel/tap/ow`                  | macOS/Linux users who prefer brew |
| **npm**      | `npm install -g offworld`                        | Node.js developers                |

All three methods install the same `ow` binary. Users choose based on preference.

---

## Prerequisites

Before any distribution method works, you need:

1. **Compiled binaries** for each platform (via `bun build --compile`)
2. **GitHub Releases** hosting the binaries
3. **npm package** published to registry

### Build Targets

```bash
# macOS
bun build apps/cli/src/cli.ts --compile --target=bun-darwin-arm64 --outfile dist/ow-darwin-arm64
bun build apps/cli/src/cli.ts --compile --target=bun-darwin-x64 --outfile dist/ow-darwin-x64

# Linux
bun build apps/cli/src/cli.ts --compile --target=bun-linux-arm64 --outfile dist/ow-linux-arm64
bun build apps/cli/src/cli.ts --compile --target=bun-linux-x64 --outfile dist/ow-linux-x64
```

### GitHub Release Assets

Each release (`v0.1.0`, etc.) should have:

```
ow-darwin-arm64.tar.gz
ow-darwin-x64.tar.gz
ow-linux-arm64.tar.gz
ow-linux-x64.tar.gz
checksums.txt
```

---

## 1. curl Install

### User Experience

`{bash} curl -fsSL https://offworld.sh/install | bash`

### How It Works

1. User runs curl command
2. offworld.sh serves the install script (no `.sh` extension)
3. Script detects OS/arch, downloads binary from GitHub Releases
4. Installs to `~/.local/bin/ow`
5. Prompts user to add to PATH if needed

### Implementation

#### Install Script

Create `install` (no extension) to be served at `https://offworld.sh/install`:

```bash
#!/bin/bash
set -e

REPO="offworld-sh/offworld"
INSTALL_DIR="${OW_INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="ow"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}==>${NC} $1"; }
success() { echo -e "${GREEN}==>${NC} $1"; }
error() { echo -e "${RED}Error:${NC} $1" >&2; exit 1; }

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *) error "Unsupported operating system: $(uname -s)" ;;
  esac
}

# Detect architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) error "Unsupported architecture: $(uname -m)" ;;
  esac
}

# Get latest version from GitHub
get_latest_version() {
  curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' \
    | cut -d'"' -f4
}

# Verify checksum
verify_checksum() {
  local file="$1"
  local expected="$2"
  local actual

  if command -v sha256sum &> /dev/null; then
    actual=$(sha256sum "$file" | cut -d' ' -f1)
  elif command -v shasum &> /dev/null; then
    actual=$(shasum -a 256 "$file" | cut -d' ' -f1)
  else
    info "Skipping checksum verification (no sha256sum or shasum found)"
    return 0
  fi

  if [ "$actual" != "$expected" ]; then
    error "Checksum verification failed!\nExpected: $expected\nActual: $actual"
  fi
}

main() {
  local os=$(detect_os)
  local arch=$(detect_arch)
  local version=$(get_latest_version)
  local version_num="${version#v}"  # Remove 'v' prefix

  info "Installing ow $version for $os-$arch..."

  # Create install directory
  mkdir -p "$INSTALL_DIR"

  # Download binary
  local download_url="https://github.com/$REPO/releases/download/$version/ow-$os-$arch.tar.gz"
  local tmp_dir=$(mktemp -d)
  local archive="$tmp_dir/ow.tar.gz"

  info "Downloading from $download_url"
  curl -fsSL "$download_url" -o "$archive" || error "Download failed"

  # Download and verify checksum
  local checksums_url="https://github.com/$REPO/releases/download/$version/checksums.txt"
  local checksums="$tmp_dir/checksums.txt"

  if curl -fsSL "$checksums_url" -o "$checksums" 2>/dev/null; then
    local expected_checksum=$(grep "ow-$os-$arch.tar.gz" "$checksums" | cut -d' ' -f1)
    if [ -n "$expected_checksum" ]; then
      info "Verifying checksum..."
      verify_checksum "$archive" "$expected_checksum"
    fi
  fi

  # Extract and install
  info "Extracting..."
  tar -xzf "$archive" -C "$tmp_dir"

  # Find the binary (might be ow or ow-darwin-arm64, etc.)
  local binary=$(find "$tmp_dir" -name "ow*" -type f -perm -u+x | head -1)
  if [ -z "$binary" ]; then
    binary=$(find "$tmp_dir" -name "ow*" -type f | head -1)
  fi

  if [ -z "$binary" ]; then
    error "Could not find ow binary in archive"
  fi

  mv "$binary" "$INSTALL_DIR/$BINARY_NAME"
  chmod +x "$INSTALL_DIR/$BINARY_NAME"

  # Cleanup
  rm -rf "$tmp_dir"

  success "Installed ow $version to $INSTALL_DIR/$BINARY_NAME"

  # Check if install dir is in PATH
  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "Add ow to your PATH by adding this to your shell config:"
    echo ""
    case "$SHELL" in
      */zsh)
        echo "  echo 'export PATH=\"\$PATH:$INSTALL_DIR\"' >> ~/.zshrc"
        echo "  source ~/.zshrc"
        ;;
      */bash)
        echo "  echo 'export PATH=\"\$PATH:$INSTALL_DIR\"' >> ~/.bashrc"
        echo "  source ~/.bashrc"
        ;;
      *)
        echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
        ;;
    esac
    echo ""
  fi

  echo "Run 'ow --help' to get started."
}

main "$@"
```

#### Hosting on offworld.sh

**TanStack Start API Route**

```typescript
// apps/web/app/routes/install.ts
import { createAPIFileRoute } from "@tanstack/start/api";
import { readFile } from "fs/promises";
import { join } from "path";

export const APIRoute = createAPIFileRoute("/install")({
	GET: async () => {
		const script = await readFile(join(process.cwd(), "public", "install"), "utf-8");
		return new Response(script, {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "public, max-age=300", // 5 min cache
			},
		});
	},
});
```

Then place script at `public/install.txt`.

#### Uninstall Script (Optional)

Provide at `https://offworld.sh/uninstall`:

```bash
#!/bin/bash
set -e

INSTALL_DIR="${OW_INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="ow"

if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
  rm "$INSTALL_DIR/$BINARY_NAME"
  echo "Removed $INSTALL_DIR/$BINARY_NAME"
else
  echo "ow not found at $INSTALL_DIR/$BINARY_NAME"
fi

echo ""
echo "To complete uninstallation, remove any PATH modifications from your shell config."
```

---

## 2. Homebrew

### User Experience

```bash
brew install oscabriel/tap/ow
```

Or with explicit tap:

```bash
brew tap oscabriel/tap
brew install ow
```

### How It Works

1. Homebrew fetches formula from `github.com/oscabriel/homebrew-tap`
2. Formula downloads binary from GitHub Releases
3. Homebrew installs to `/opt/homebrew/bin/ow` (Apple Silicon) or `/usr/local/bin/ow` (Intel)
4. Automatic PATH management by Homebrew

### Implementation

#### Create Tap Repository

```bash
# Create the repo (must be named homebrew-tap)
gh repo create oscabriel/homebrew-tap --public --description "Homebrew tap for personal CLIs"

# Clone and set up
git clone https://github.com/oscabriel/homebrew-tap.git
cd homebrew-tap
mkdir Formula
```

#### Formula

Create `Formula/ow.rb`:

```ruby
class Ow < Formula
  desc "Clone OSS repos and auto-generate AI agent skills"
  homepage "https://offworld.sh"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/offworld-sh/offworld/releases/download/v#{version}/ow-darwin-arm64.tar.gz"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"

      def install
        bin.install "ow-darwin-arm64" => "ow"
      end
    end

    on_intel do
      url "https://github.com/offworld-sh/offworld/releases/download/v#{version}/ow-darwin-x64.tar.gz"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"

      def install
        bin.install "ow-darwin-x64" => "ow"
      end
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/offworld-sh/offworld/releases/download/v#{version}/ow-linux-arm64.tar.gz"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"

      def install
        bin.install "ow-linux-arm64" => "ow"
      end
    end

    on_intel do
      url "https://github.com/offworld-sh/offworld/releases/download/v#{version}/ow-linux-x64.tar.gz"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"

      def install
        bin.install "ow-linux-x64" => "ow"
      end
    end
  end

  test do
    assert_match "ow #{version}", shell_output("#{bin}/ow --version")
  end
end
```

#### Automated Formula Updates

Add to main repo `.github/workflows/release.yml`:

```yaml
update-homebrew:
  needs: [build, release]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        repository: oscabriel/homebrew-tap
        token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
        path: homebrew-tap

    - name: Download checksums
      run: |
        curl -fsSL "https://github.com/offworld-sh/offworld/releases/download/${{ github.ref_name }}/checksums.txt" -o checksums.txt

    - name: Update formula
      run: |
        VERSION="${{ github.ref_name }}"
        VERSION="${VERSION#v}"  # Remove 'v' prefix

        DARWIN_ARM64_SHA=$(grep "ow-darwin-arm64.tar.gz" checksums.txt | cut -d' ' -f1)
        DARWIN_X64_SHA=$(grep "ow-darwin-x64.tar.gz" checksums.txt | cut -d' ' -f1)
        LINUX_ARM64_SHA=$(grep "ow-linux-arm64.tar.gz" checksums.txt | cut -d' ' -f1)
        LINUX_X64_SHA=$(grep "ow-linux-x64.tar.gz" checksums.txt | cut -d' ' -f1)

        cd homebrew-tap

        # Update version
        sed -i "s/version \".*\"/version \"$VERSION\"/" Formula/ow.rb

        # Update checksums (order matters - match the file structure)
        # This is a simplified approach; production should use proper Ruby parsing
        sed -i "0,/sha256 \".*\"/s//sha256 \"$DARWIN_ARM64_SHA\"/" Formula/ow.rb
        sed -i "0,/sha256 \".*\"/s//sha256 \"$DARWIN_X64_SHA\"/" Formula/ow.rb
        sed -i "0,/sha256 \".*\"/s//sha256 \"$LINUX_ARM64_SHA\"/" Formula/ow.rb
        sed -i "0,/sha256 \".*\"/s//sha256 \"$LINUX_X64_SHA\"/" Formula/ow.rb

    - name: Commit and push
      run: |
        cd homebrew-tap
        git config user.name "GitHub Actions"
        git config user.email "actions@github.com"
        git add Formula/ow.rb
        git commit -m "Update ow to ${{ github.ref_name }}"
        git push
```

#### Testing Locally

```bash
# Test formula syntax
brew audit --strict Formula/ow.rb

# Test installation from local formula
brew install --build-from-source ./Formula/ow.rb

# Test the installed binary
brew test ow

# Uninstall
brew uninstall ow
```

---

## 3. npm

### User Experience

```bash
npm install -g offworld
```

Then:

```bash
ow clone tanstack/router
```

### How It Works

1. npm downloads package from registry
2. Package includes bundled JS (no native binaries)
3. npm links `ow` command to `bin` script
4. Runs via Node.js runtime

### Implementation

#### Package Structure

```
apps/cli/
├── package.json
├── src/
│   └── cli.ts
└── dist/           # Built output
    └── cli.mjs
```

#### package.json

```json
{
	"name": "offworld",
	"version": "0.1.0",
	"description": "Clone OSS repos and auto-generate AI agent skills",
	"bin": {
		"ow": "dist/cli.mjs"
	},
	"files": ["dist"],
	"type": "module",
	"engines": {
		"node": ">=18"
	},
	"keywords": ["cli", "git", "clone", "ai", "skills", "opencode", "agent"],
	"author": "offworld-sh",
	"license": "MIT",
	"repository": {
		"type": "git",
		"url": "https://github.com/offworld-sh/offworld.git",
		"directory": "apps/cli"
	},
	"homepage": "https://offworld.sh",
	"scripts": {
		"build": "tsdown src/cli.ts --format esm --out-dir dist",
		"prepublishOnly": "bun run build"
	}
}
```

#### Entry Point

```typescript
#!/usr/bin/env node
// apps/cli/src/cli.ts

import { createOwCli } from "./index";

createOwCli().run();
```

Note: The shebang `#!/usr/bin/env node` is required for npm to execute it as a CLI.

#### Build Configuration

```typescript
// apps/cli/tsdown.config.ts
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/cli.ts"],
	format: ["esm"],
	outDir: "dist",
	clean: true,
	dts: false,
	minify: true,
	// Bundle all dependencies
	noExternal: [/.*/],
});
```

#### Publishing

```bash
# Login to npm
npm login

# Publish (runs prepublishOnly automatically)
npm publish

# Publish with tag
npm publish --tag beta
```

#### Automated Publishing

Add to `.github/workflows/release.yml`:

```yaml
publish-npm:
  needs: [build, release]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2

    - name: Install dependencies
      run: bun install

    - name: Build
      run: bun run build
      working-directory: apps/cli

    - name: Setup npm
      run: echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > ~/.npmrc

    - name: Publish
      run: npm publish
      working-directory: apps/cli
```

---

## Full Release Workflow

Complete `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-14 # Apple Silicon runner
            target: darwin-arm64
          - os: macos-13 # Intel runner
            target: darwin-x64
          - os: ubuntu-latest
            target: linux-x64
          - os: ubuntu-24.04-arm # ARM runner
            target: linux-arm64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Build CLI
        run: bun run build
        working-directory: apps/cli

      - name: Compile binary
        run: |
          bun build apps/cli/dist/cli.mjs \
            --compile \
            --minify \
            --outfile ow-${{ matrix.target }}

      - name: Create archive
        run: tar -czf ow-${{ matrix.target }}.tar.gz ow-${{ matrix.target }}

      - uses: actions/upload-artifact@v4
        with:
          name: ow-${{ matrix.target }}
          path: ow-${{ matrix.target }}.tar.gz

  release:
    needs: build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Flatten artifacts
        run: |
          mkdir release
          find artifacts -name "*.tar.gz" -exec mv {} release/ \;

      - name: Create checksums
        run: |
          cd release
          sha256sum *.tar.gz > checksums.txt

      - uses: softprops/action-gh-release@v2
        with:
          files: release/*
          generate_release_notes: true

  publish-npm:
    needs: release
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2

      - run: bun install
      - run: bun run build
        working-directory: apps/cli

      - run: echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > ~/.npmrc
      - run: npm publish
        working-directory: apps/cli

  update-homebrew:
    needs: release
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          repository: oscabriel/homebrew-tap
          token: ${{ secrets.HOMEBREW_TAP_TOKEN }}

      - name: Update formula
        run: |
          VERSION="${{ github.ref_name }}"
          VERSION="${VERSION#v}"

          # Download checksums
          curl -fsSL "https://github.com/offworld-sh/offworld/releases/download/${{ github.ref_name }}/checksums.txt" -o /tmp/checksums.txt

          # Update formula with new version and checksums
          # (simplified - use proper script in production)
          python3 << 'EOF'
          import re

          version = "$VERSION"

          with open("/tmp/checksums.txt") as f:
              checksums = {}
              for line in f:
                  sha, name = line.strip().split()
                  checksums[name] = sha

          with open("Formula/ow.rb") as f:
              content = f.read()

          content = re.sub(r'version ".*"', f'version "{version}"', content)

          # Update each sha256 in order
          targets = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"]
          for target in targets:
              sha = checksums.get(f"ow-{target}.tar.gz", "")
              content = re.sub(
                  rf'(on_{target.replace("-", r".*")}.*?sha256 ")[^"]*(")',
                  rf'\g<1>{sha}\2',
                  content,
                  count=1,
                  flags=re.DOTALL
              )

          with open("Formula/ow.rb", "w") as f:
              f.write(content)
          EOF

      - name: Commit and push
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add Formula/ow.rb
          git commit -m "Update ow to ${{ github.ref_name }}"
          git push
```

---

## Secrets Required

| Secret               | Where to Set            | Purpose                             |
| -------------------- | ----------------------- | ----------------------------------- |
| `NPM_TOKEN`          | Repo Settings → Secrets | npm publish                         |
| `HOMEBREW_TAP_TOKEN` | Repo Settings → Secrets | Push to oscabriel/homebrew-tap repo |

### Creating NPM Token

1. Go to npmjs.com → Account → Access Tokens
2. Generate New Token → Automation
3. Copy token, add as `NPM_TOKEN` secret

### Creating Homebrew Token

1. Go to github.com → Settings → Developer Settings → Personal Access Tokens
2. Generate new token (classic) with `repo` scope
3. Copy token, add as `HOMEBREW_TAP_TOKEN` secret

---

## Checklist

### Before First Release

- [ ] Create `oscabriel/homebrew-tap` repository
- [ ] Add `Formula/ow.rb` with placeholder checksums
- [ ] Create npm account, reserve `offworld` package name
- [ ] Add `NPM_TOKEN` secret to main repo
- [ ] Add `HOMEBREW_TAP_TOKEN` secret to main repo
- [ ] Create `install` script in web app public folder
- [ ] Configure hosting for `/install` endpoint
- [ ] Test curl install locally
- [ ] Test brew install from local formula
- [ ] Test npm publish with `--dry-run`

### For Each Release

1. Update version in `apps/cli/package.json`
2. Create and push git tag: `git tag v0.1.0 && git push --tags`
3. GitHub Actions handles the rest

---

## Testing Each Method

```bash
# curl
curl -fsSL https://offworld.sh/install | bash
ow --version

# Homebrew
brew install oscabriel/tap/ow
ow --version

# npm
npm install -g offworld
ow --version
```

---

_Last updated: January 2026_
