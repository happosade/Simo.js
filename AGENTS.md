# Simo.js — Agent Guide

> **Read this first.** Detailed docs live in `docs/`. This file is the entry point for AI coding agents.

## What Is This?

**Simo.js** is an IRC bot. Its only output mechanism is `client.say(channel, text)`. There is no web frontend, no REST API to build against, and no user-visible UI beyond IRC chat.

## Quick Start (Local Dev)

```bash
# Start the full local dev stack (IRC server + bot + Redis)
docker compose -f docker-compose.dev.yml up --build

# Tail bot logs
docker compose -f docker-compose.dev.yml logs -f simojs

# Connect an IRC client to the local server, join #test, talk to the bot
# e.g. irssi: /connect localhost 6667 && /join #test
# Try:  !coinflip   !random   !test
```

The dev stack boots an **ircdjs** IRC server on `localhost:6667`. Simo connects to it automatically. No external IRC server, API keys, or GPU required.

After editing a feature file, restart the simojs container:
```bash
docker compose -f docker-compose.dev.yml restart simojs
```

## Adding a Feature

Copy `features/example.js` to a new file. That's it — the loader discovers it automatically.

```js
// features/myfeature.js
module.exports = {
    commands: {
        '!mycommand': function(client, channel, from, line) {
            const args = line.split(' ').slice(1);
            client.say(channel, 'Hello from ' + args.join(' '));
        }
    }
};
```

See `docs/features.md` for the full plugin contract, regex handlers, and the macro system.

## Key Rules

| Rule | Why |
|---|---|
| **Never modify `main.js` to add commands** | Features belong in `features/` |
| **IRC responses ≤ 400 chars** | Hard-truncated in `main.js`; design for 390 |
| **Settings from `/simojs-data/settings.json`** | Never hardcode secrets |
| **Persistent files in `/simojs-data/`** | Only this directory survives container rebuilds |
| **Don't commit `settings.json`** | It contains credentials |

## Architecture in 30 seconds

```
IRC message → main.js
                ├─ regex handlers (features/*)
                ├─ URL title fetcher (lib/urltitle.js)
                └─ MultiCommand.exec
                      ├─ !command → JS feature handler
                      └─ unknown  → POST pythonsimo:8888
```

See `docs/architecture.md` for the full diagram.

## File Map

| Path | Role |
|---|---|
| `main.js` | Entry point — read before touching dispatch logic |
| `features/index.js` | Auto-loader — do not modify |
| `features/example.js` | Template for new features |
| `lib/multicommand.js` | `!command` dispatch + pythonsimo fallback |
| `lib/timerdb.js` | SQLite helper for scheduled messages |
| `lib/simoInflux.js` | `sendMetric(name, value, tags)` — instrument features |
| `docker-compose.yml` | Production stack |
| `docker-compose.dev.yml` | Local dev stack (ircd + simojs + redis) |
| `Dockerfile.dev` | Multi-stage dev image (npm install isolated from secrets) |
| `settings.json.example` | Config template — update when adding new keys |
| `dev/simojs-data/settings.json` | Dev settings (IRC → ircd:6667, empty API keys) |
| `docs/` | Detailed docs: architecture, features, infrastructure |

## npm Security Model

- `.npmrc` enforces `audit=true` and `save-exact=true`.
- `Dockerfile.dev` uses a **multi-stage build**: `npm install` runs in stage 1 with no secrets in the environment. Runtime secrets (API keys) arrive only via bind-mounted `settings.json` at container start — never during the build.
- To add a dependency: add it to `package.json`, rebuild the container. Do **not** pass secrets as Docker `--build-arg`.

## What NOT to Do

- Don't add features in `main.js`
- Don't commit `settings.json` or `.env` files with real credentials
- Don't pass secrets as Docker `ARG`/`ENV` in a Dockerfile (they appear in image layers)
- Don't write persistent data outside `/simojs-data/`
- Don't push IRC responses longer than 400 chars — truncation is already applied, but design for 390 to be safe
