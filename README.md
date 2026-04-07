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
- optional webhook bridge for forwarding verified Linear webhooks into OpenClaw

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

## Webhook bridge

This repo also includes a tiny webhook bridge at `bridge/server.js`.

Use it when a provider like Linear signs payloads but cannot add the auth header your OpenClaw hook expects.

### Environment

```bash
export LINEAR_WEBHOOK_SECRET=your_linear_signing_secret
export OPENCLAW_HOOK_URL=https://your-gateway-host/hooks/linear
export OPENCLAW_HOOK_TOKEN=your_openclaw_hook_token
export LINEAR_ALLOWED_TEAM_KEYS=KIR
```

### Run locally

```bash
npm run bridge:dev
```

Endpoints:
- `POST /linear-webhook`
- `GET /health`

Behavior:
- verifies `linear-signature`
- ignores events outside the allowed team list
- forwards accepted payloads to your OpenClaw hook using bearer auth

## Roadmap

Planned next additions:

- state helpers (`states list`)
- project/issue lookup by name or slug
- assignment helpers
- richer webhook filtering/normalization
- heartbeat-oriented commands (`my-work`, `blocked`, `backlog`)

## License

MIT
