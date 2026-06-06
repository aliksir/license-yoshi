# Changelog

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
