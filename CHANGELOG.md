# Changelog

All notable changes to this project will be documented in this file.

## 0.1.2

### Fixed
- `search_filaments` and `get_filament` round-trip works end-to-end. Search results now include the display ID, and `get_filament` accepts the multiple lookup formats it advertises.
- FTS5 search index now covers manufacturer and material columns in addition to the previous fields, so free-text queries like "Prusament PLA" return matches.

### Changed
- `src/data/3dprint.sqlite` is now tracked in git so Glama's container build picks up the prebuilt database (auto-rebuild compatibility).

## 0.1.1

### Fixed
- Reworked `recommend_material` to use a 0-100 weighted scoring model.
- Resolved symlinks in `isMain` detection so the binary works under npm global installs.

## 0.1.0

Initial release.

- 8 MCP tools: `search_filaments`, `get_filament`, `list_manufacturers`, `list_materials`, `get_material_profile`, `compare_materials`, `recommend_material`, `diagnose_print_issue`.
- SpoolmanDB filament data ingested into embedded SQLite with FTS5 search.
- Curated material knowledge layer with troubleshooting profiles.
- Listed on Glama, registered with the MCP Registry.
