# license-yoshi
> Part of the [neko-HQ](https://github.com/aliksir/neko-hq) ecosystem.

Dependency license checker for Node.js projects. Classifies npm package licenses into 4 tiers (allowed / caution / forbidden / unknown) and blocks commits containing forbidden or unknown licenses.

Zero dependencies. Uses only Node.js built-in modules.

## Quick Start

```bash
# Check all dependencies in current project
npx license-yoshi --all

# Check only newly added dependencies (staged in git)
npx license-yoshi --cached

# Use with a specific directory
npx license-yoshi --all --dir /path/to/project
```

## Installation

```bash
npm install -g license-yoshi
# or as a dev dependency
npm install --save-dev license-yoshi
```

## CLI Usage

```
license-yoshi [options]

Options:
  --dir <path>         Target directory (default: cwd)
  --cached             Check only dependencies added in staged changes (default)
  --all                Check all dependencies in package.json
  --rules <path>       Custom rules file (JSON)
  --strict             Treat expired allowlist entries as FAIL
  --json               Output results in JSON format
  --help               Show help
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All dependencies are allowed or caution-only |
| 1 | Forbidden or unknown license detected |

## License Classification

Default rules based on embedded binary distribution requirements:

| Tier | Licenses | Action |
|------|----------|--------|
| **Allowed** | MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, Unlicense, CC0-1.0, Zlib | Pass |
| **Caution** | LGPL-2.1, LGPL-3.0, MPL-2.0, EPL-2.0 | Warning (no block) |
| **Forbidden** | GPL-2.0, GPL-3.0, AGPL-3.0, SSPL-1.0, BSL-1.1, EUPL-1.1/1.2 | Block (exit 1) |
| **Unknown** | No license / unrecognized | Block (exit 1) |

## Pre-commit Hook Setup

### With Husky

```bash
npx husky add .husky/pre-commit "npx license-yoshi --cached"
```

### Manual git hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
npx license-yoshi --cached
```

### Claude Code Plugin

This tool ships as a Claude Code plugin. Install it in your project:

```bash
# Copy .claude-plugin/ to your project
cp -r node_modules/license-yoshi/.claude-plugin .claude-plugin/license-yoshi
```

The plugin hooks into `git commit` commands and automatically runs license checks.

## Custom Rules

Override default rules with a JSON file:

```json
{
  "allowed": ["MIT", "Apache-2.0", "ISC"],
  "caution": ["LGPL-3.0"],
  "forbidden": ["GPL-3.0", "AGPL-3.0"]
}
```

```bash
license-yoshi --all --rules my-rules.json
```

When `--rules` is specified, default rules are **completely replaced** (no merging).

## Allowlist

### JSON format (recommended)

Create `.license-yoshi-allow.json` for audit-ready allowlist with metadata:

```json
[
  { "pkg": "some-gpl-package", "reason": "Internal use only", "approved_by": "admin", "expires": "2027-01-01" },
  { "pkg": "@scope/special-package", "reason": "Evaluated and accepted" }
]
```

Allowlisted packages are still included in the output with `status: "allowed"` (not silently skipped).
Use `--strict` to treat expired entries as failures.

### Text format (legacy)

Create `.license-yoshi-allow` in your project root (one package name per line, `#` for comments).
If both files exist, the JSON format takes priority.

## Caching

License lookups are cached at `~/.license-yoshi-cache.json` with a 7-day TTL. Delete this file to force fresh lookups.

## Requirements

- Node.js 18+
- git (for `--cached` mode, uses `git diff`)

## License

MIT
