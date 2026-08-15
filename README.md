# immich-album-sorter

Adjust Immich asset timestamps within an album so images display in filename order.

## Install

```bash
npm install
```

## Usage

```bash
npx tsx src/index.ts --url <immich-url> --api-key <key> --album <name> [--increment <seconds>] [--force]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--url` | yes | — | Immich server base URL (e.g. `http://localhost:2283`) |
| `--api-key` | yes | — | Immich API key (`asset.update` permission) |
| `--album` | yes | — | Exact album name |
| `--increment` | no | `1` | Seconds to add per subsequent file |
| `--force` | no | `false` | Apply changes without confirmation prompt |

By default the tool runs in dry-run mode and prints a table of planned changes.

## Example

```bash
npx tsx src/index.ts --url http://localhost:2283 --api-key xxx --album "Vacation 2024"
```

```bash
npx tsx src/index.ts --url http://localhost:2283 --api-key xxx --album "Vacation 2024" --increment 5 --force
```

## Development

```bash
npm test
```
