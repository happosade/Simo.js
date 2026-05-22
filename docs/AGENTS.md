# AI Agent Guide — Simo.js

This document exists specifically to help AI coding agents (GitHub Copilot, Claude, GPT, etc.) work effectively in this codebase. Read this before making changes.

---

## Project Identity

**Simo.js** is an IRC bot. It is **not** a web app, CLI tool, or library. Every user-facing action happens by calling `client.say(channel, text)` on an IRC client. The primary "UI" is IRC chat.

---

## Critical Conventions

### 1. Feature plugins are the only place to add new functionality

Never modify `main.js` to add commands. Add a new file to `features/` instead.  
`features/index.js` auto-discovers all `.js` files in that directory — no registration needed.

### 2. IRC response length limit

Responses sent to IRC must be ≤ 400 characters (enforced in `main.js`).  
Long content should be written to `/simojs-data/html/<filename>.html` and a URL returned instead.  
The URL pattern in use: `http://gpt.prototyping.xyz/<filename>`.

### 3. Settings are read from `/simojs-data/settings.json`

Feature files access settings like this:
```js
const settings = JSON.parse(fs.readFileSync('/simojs-data/settings.json'));
const apiKey = settings.myservice.api_key;
```
**Never hardcode secrets.** Always read them from settings at runtime.  
When adding a new external service, add its config block to `settings.json.example` too.

### 4. Persistent data lives in `/simojs-data/`

The `/simojs-data/` directory is bind-mounted from the host. Write any state files there.  
The timer SQLite database is at `/simojs-data/simojs.sqlite`.  
The macros JSON is at `/simojs-data/macros.js`.

### 5. Node.js version is old (v8)

The container runs Node.js v8.17.0. Use `var`/`function` or ES6 that works on v8.  
**Avoid:** `?.` optional chaining, `??` nullish coalescing, `async/await` in older patterns.  
Most features already use `const`/`let`, arrow functions, and `Promise` — that is fine.

### 6. No test suite exists yet

There are no automated tests. Validate changes manually or write tests only if explicitly requested.

---

## Feature File Template

```js
// features/myfeature.js
const fs = require('fs');

// Read settings once at module load time (or in init)
// const settings = JSON.parse(fs.readFileSync('/simojs-data/settings.json'));

const init = function(config, client) {
    // Runs once at startup. Use for timers, streams, background tasks.
    // config: parsed settings.json
    // client: irc-upd client (connected shortly after init)
};

const myCommand = function(client, channel, from, line) {
    // line: full message, e.g. "!mycommand arg1 arg2"
    const args = line.split(' ').slice(1);  // drop the command name
    client.say(channel, 'response here');
};

module.exports = {
    commands: {
        '!mycommand': myCommand,
    },
    init: init,   // omit if not needed
    // regexes: { key: fn }   // omit if not needed
};
```

---

## Key Files and Their Roles

| File | What to know |
|---|---|
| `main.js` | Entry point. Read-only unless changing core dispatch logic. |
| `features/index.js` | Auto-loader. Read-only — do not modify. |
| `features/example.js` | Template for new features. Copy this. |
| `lib/multicommand.js` | Handles `!command` chaining and pythonsimo fallback. |
| `lib/timerdb.js` | SQLite wrapper. Reuse when needing persistent scheduled messages. |
| `lib/simoInflux.js` | `sendMetric(name, value, tags)` — use to instrument new features. |
| `lib/api.js` | Sandbox API for `!run` scripts — only relevant for sandcastle feature. |
| `docker-compose.yml` | Service topology. Edit when adding a new microservice. |
| `settings.json.example` | Config template. Always update when adding new settings keys. |

---

## Common Patterns

### Sending a message
```js
client.say(channel, 'text');  // to channel
client.say(from, 'text');     // private message to sender
```

### Parsing command arguments
```js
// line = "!mycommand foo bar baz"
const args = line.split(' ').slice(1);  // ['foo', 'bar', 'baz']
const rest = line.split(' ').slice(1).join(' ');  // 'foo bar baz'
```

### Calling an external HTTP API
```js
const axios = require('axios');
axios.get(url).then(res => {
    client.say(channel, res.data.something.substring(0, 390));
}).catch(err => {
    console.error('myfeature error:', err);
    client.say(channel, 'Error: ' + err.message);
});
```

### Writing long output as HTML
```js
const fs = require('fs');
const moment = require('moment');
const timestamp = moment().format('YYYY-MM-DD---HH-mm-ss');
const htmlPath = `/simojs-data/html/${timestamp}--myfeature.html`;
fs.writeFileSync(htmlPath, `<html><body>${content}</body></html>`);
client.say(channel, `http://gpt.prototyping.xyz/${timestamp}--myfeature.html`);
```

### Scheduling a reminder (using TimerDB)
```js
const TimerDB = require('../lib/timerdb').TimerDB;
const timerdb = new TimerDB();
const moment = require('moment');
timerdb.schedule(
    moment().add(5, 'minutes').unix(),
    channel, from, 'Reminder text',
    (err, date) => {
        if (!err) client.say(channel, 'Reminder set!');
    }
);
```

---

## Architecture Quick-Reference

```
IRC → main.js
         ├─ features/*.js  (commands, regexes, inits)
         ├─ lib/multicommand.js  (dispatch + pythonsimo fallback)
         ├─ lib/urltitle.js  (URL → <title>)
         └─ lib/timerpoller.js  (SQLite → timed client.say)

External services (all via docker-compose network):
  pythonsimo:8888   Python feature service
  llama:8111        Local LLM (llama.cpp)
  redis             Key-value state
  influxdb:8086     Metrics
```

---

## What NOT to Do

- **Don't add features directly in `main.js`** — use a feature plugin
- **Don't commit `settings.json`** or any file containing real credentials
- **Don't assume internet connectivity** from within the container without checking `extra_hosts` config
- **Don't write to paths outside `/simojs-data/`** for persistent state (it won't survive container rebuild)
- **Don't use `require('path')` to construct absolute paths from `__dirname`** for data files — use `/simojs-data/` directly
- **Don't break the `!run` / macro system** — it is relied upon heavily by users for custom scripts
- **Don't increase IRC response beyond 400 chars** — truncation is already in `main.js` but design for 390 to be safe

---

## Adding a Dependency

1. Add it to `package.json` `dependencies`
2. Rebuild the container: `docker-compose build simojs && docker-compose up -d simojs`

The `npm install` step runs inside the Docker build, not on the host.
