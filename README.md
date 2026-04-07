# linear-cli

A small public Node CLI for the most common Linear workflows.

It is designed to stay simple, scriptable, and safe for public distribution.
It does **not** store tokens, ship secrets, or assume any Kirkland-specific configuration.

## Features

- `linear-cli me`
- `linear-cli teams`
- `linear-cli projects list`
- `linear-cli projects create`
- `linear-cli issues list`
- `linear-cli issues create`
- `linear-cli issues update`
- `linear-cli comments add`

## Install

```bash
npm install
npm run prepare
```

Or run directly:

```bash
node ./bin/linear-cli.js me
```

## Auth

Set a Linear API token in your environment:

```bash
export LINEAR_API_KEY=lin_api_xxx
```

The CLI reads the token from `LINEAR_API_KEY` only.

## Usage

### Viewer / teams

```bash
linear-cli me
linear-cli teams
```

### Projects

```bash
linear-cli projects list
linear-cli projects list --team KIR
linear-cli projects create --name "Stacked" --team KIR --description "MTG growth and product work"
```

### Issues

```bash
linear-cli issues list --team KIR
linear-cli issues create --team KIR --title "Set up homepage screenshots" --description "Capture desktop/mobile screenshots for UI PRs"
linear-cli issues update --id <issue-id> --priority 2
```

### Comments

```bash
linear-cli comments add --issue <issue-id> --body "Progress update: validation passed."
```

### JSON mode

Every command supports `--json`.

```bash
linear-cli me --json
```

## Safety

This repo is intended to remain public-safe:

- no tokens committed
- no workspace-specific data hardcoded
- no webhook secrets committed
- no hidden config files required

## Roadmap

Planned next additions:

- state helpers (`states list`)
- project/issue lookup by name or slug
- assignment helpers
- webhook receiver examples
- heartbeat-oriented commands (`my-work`, `blocked`, `backlog`)

## License

MIT
