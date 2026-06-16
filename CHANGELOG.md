# Changelog

## [0.3.0] - 2026-06-16

### Added
- DI pattern (execFn) for checker and detector — enables unit testing without real npm/git calls
- Unit tests for checkLicense, checkLicenses, detectAddedDeps (+33 tests, total 81)
- `exports` field in package.json

### Fixed
- Silent catch{} in rules.mjs — errors now logged to stderr
- isPackageName regex now accepts uppercase package names (e.g. BigInteger)

## [0.2.0] - 2026-06-08

### Added
- JSON allowlist format with audit fields
- `--strict` and `--json` CLI options
- Schema v1.1 compliance with severity and summary fields
- `.neko-policy/license-policy.json` as classifier source

## [0.1.0] - 2026-06-07

### Added
- Initial release
- Detect newly added dependencies from `git diff --cached`
- Check all dependencies with `--all` flag
- 4-tier license classification: allowed / caution / forbidden / unknown
- License normalization (SPDX aliases, case-insensitive matching)
- npm info-based license fetching with local cache (7-day TTL)
- `.license-yoshi-allow` allowlist support
- Custom rules via `--rules <path>` (JSON, full override)
- Claude Code plugin manifest and pre-commit hook integration
