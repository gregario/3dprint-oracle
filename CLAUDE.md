# 3dprint-oracle

MCP server for 3D printing filament data and material science knowledge.

## Stack Profiles

- MCP stack profile: `../../stacks/mcp/`
- TypeScript stack profile: `../../stacks/typescript/`

Read both stack profiles before writing any code.

## Architecture

- **Embedded data**: SpoolmanDB JSON ingested into SQLite at build time
- **Does NOT fetch at runtime**: all data bundled in the npm package
- **Updates**: Run `npm run fetch-data` to refresh from SpoolmanDB
- **Storage**: SQLite with FTS5 for search
- **Knowledge layer**: Curated material profiles and troubleshooting in data/knowledge/

## Data Source

Filament data from SpoolmanDB (github.com/Donkie/SpoolmanDB, MIT license).

## Data File

`src/data/3dprint.sqlite` is **tracked in git** (~1.4 MB) for Glama auto-rebuild compatibility. Glama clones the repo and runs the build inside its container — gitignored data files would not exist there, so the listing would show zero tools. Refresh the database via `npm run fetch-data` before publishing a new release.

## Engineering

Uses Superpowers for engineering execution. Follow TDD workflow: write tests first, then implement.
