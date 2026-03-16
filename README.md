<p align="center">
  <a href="https://www.npmjs.com/package/3dprint-oracle"><img src="https://img.shields.io/npm/v/3dprint-oracle.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/3dprint-oracle"><img src="https://img.shields.io/npm/dm/3dprint-oracle.svg" alt="npm downloads"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js 18+"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/sponsors/gregario"><img src="https://img.shields.io/badge/sponsor-♥-ea4aaa.svg" alt="Sponsor"></a>
</p>

# 3dprint-oracle

3D printing filament and materials knowledge MCP server. Gives LLMs authoritative access to 7,000+ filaments and curated material science knowledge.

## Features

- **7,000+ filaments** from SpoolmanDB (53 manufacturers, 33 material types)
- **Material science knowledge** — properties, troubleshooting, recommendations
- **8 MCP tools** — search, lookup, compare, recommend, diagnose
- **Embedded data** — no API keys, no network calls at runtime

## Installation

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "3dprint-oracle": {
      "command": "npx",
      "args": ["-y", "3dprint-oracle"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `search_filaments` | Search filaments by name, material, manufacturer, color |
| `get_filament` | Get full specs for a specific filament |
| `list_manufacturers` | Browse manufacturers with filament counts |
| `list_materials` | Browse material types with counts |
| `get_material_profile` | Authoritative properties for a material type |
| `compare_materials` | Side-by-side comparison of 2-3 materials |
| `recommend_material` | Get ranked recommendations for your requirements |
| `diagnose_print_issue` | Troubleshoot print problems with material-specific fixes |

## Data Sources

- Filament data: [SpoolmanDB](https://github.com/Donkie/SpoolmanDB) (MIT license)
- Material knowledge: Hand-curated from authoritative 3D printing references

## License

MIT
