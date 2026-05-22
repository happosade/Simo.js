# Simo.js — GitHub Copilot Context

This is **Simo.js**, an IRC bot. The only user-facing output is `client.say(channel, text)`.

## Rules (always follow these)

- **New functionality → new file in `features/`**. Never modify `main.js`.
- IRC responses must be **≤ 400 characters**. Long content → write HTML to `/simojs-data/html/` and return a URL.
- Read config from `/simojs-data/settings.json`. Never hardcode secrets.
- Persistent data lives in `/simojs-data/` only.
- Don't commit `settings.json`, `.env`, or any file with real credentials.

## Feature plugin skeleton

```js
// features/myfeature.js
module.exports = {
    commands: {
        '!mycommand': function(client, channel, from, line) {
            const args = line.split(' ').slice(1);
            client.say(channel, args.join(' ') || 'no args');
        }
    },
    // init: function(config, client) { /* optional startup hook */ }
};
```

`features/index.js` auto-discovers all `.js` files — no registration needed.

## Local dev

```bash
docker compose -f docker-compose.dev.yml up --build
# IRC client: connect to localhost:6667, join #test
```

## Key files

- `main.js` — entry point (read-only unless changing core dispatch)
- `features/example.js` — copy this to add a feature
- `lib/multicommand.js` — `!command` dispatcher
- `lib/timerdb.js` — SQLite for scheduled messages
- `lib/simoInflux.js` — `sendMetric(name, value, tags)`
- `settings.json.example` — config template; update when adding keys
- `AGENTS.md` — full agent guide
- `docs/` — architecture, features, infrastructure docs
