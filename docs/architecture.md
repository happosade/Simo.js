# Architecture

## Service Overview

```
┌─────────────────────────────────────────────────────────┐
│                    docker-compose                        │
│                                                         │
│  ┌──────────┐   IRC    ┌──────────┐                     │
│  │ ircdjs   │◄────────►│ simojs   │  main.js            │
│  │(optional)│          │ (Node.js)│                     │
│  └──────────┘          └────┬─────┘                     │
│                             │                           │
│              ┌──────────────┼───────────────┐           │
│              ▼              ▼               ▼           │
│        ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│        │  Redis   │  │ InfluxDB │  │  pythonsimo  │    │
│        │ (state)  │  │(metrics) │  │ (Python HTTP)│    │
│        └──────────┘  └──────────┘  └──────────────┘    │
│                                                         │
│        ┌──────────────────────────┐                     │
│        │  llama (llama.cpp:server)│  port 8111          │
│        │  local LLM inference     │                     │
│        └──────────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## simojs Container (main process)

**Entry point:** `main.js`

### Startup sequence

1. Read `settings.json` from `/simojs-data/settings.json`
2. Load all feature plugins from `features/index.js` → builds `commands`, `regexes`, `inits` maps
3. Run every `init(config, client)` function to set up long-lived state (timers, streams, etc.)
4. Create IRC client (`irc-upd`) and connect
5. On connect: start `TimerPoller` (polls SQLite every 30 s for scheduled messages)
6. After 3 s: kick off the Twitter stream listener

### Message dispatch (per IRC message)

```
IRC message arrives
       │
       ▼
Run all regex handlers (features can register regexes)
       │
       ▼
Is it a URL? → fetch + print page title
       │
       ▼
Starts with !?
  No  → wrap as  !*r <channel> <from> <message>   (passive message macro path)
  Yes → wrap as  !*c <channel> <from> <message>   (command macro path)
       │
       ▼
Hypermacro expansion  (!* prefix → recursive macro substitution from macros.js)
       │
       ▼
MultiCommand.exec
  ├─ Command registered in simojs?   → call JS handler
  └─ Otherwise                       → POST to pythonsimo:8888
```

### MultiCommand chaining

`lib/multicommand.js` supports nested commands: if the result of one command starts with `!`, it is executed as a new command (up to `maxDepth = 100`).

### Hypermacro system

Macros are stored in `/simojs-data/macros.js` (JSON). Names must start with `_`, `+`, or `*`.  
Expansion is recursive and terminates at depth 100 or when no more `!*` tokens remain.  
User-defined macros are created/deleted via `!addmacro`, `!delmacro` (sandcastle feature).

## lib/ Modules

| Module | Role |
|---|---|
| `multicommand.js` | Recursive command dispatcher; falls back to pythonsimo over HTTP |
| `timerpoller.js` | Polls `timerdb` and calls `client.say()` at scheduled times |
| `timerdb.js` | SQLite wrapper for the `timer` table (schedule / poll / done) |
| `urltitle.js` | Fetches URL and returns `<title>` tag text; handles Spotify URIs |
| `simoInflux.js` | Thin wrapper around `influx` client; `sendMetric(name, value, tags)` |
| `api.js` | SandCastle sandbox API exposed to user scripts (`!run`) |
| `checkImage.js` | Detects whether a URL points to an image |
| `concat.js` | String utility for chaining macro output |
| `logger.js` | Logging helper |
| `shovel.js` | Data-copy utility |

## Data Flow for AI features

### OpenAI / GPT (`features/openai.js`)
- Maintains in-process conversation history (`defaultConfig.messages`)
- Short responses: printed directly to IRC (max 390 chars)
- Long responses: written as HTML to `/simojs-data/html/`, URL served at `gpt.prototyping.xyz`

### SimoGPT / local LLM (`features/simogpt.js`)
- Streams responses from `llama:8111/completion`
- Writes output incrementally to `/simojs-data/html/<timestamp>.txt`
- HTML wrapper read from `/templates/streaming.html`
- Supports cancellation via `!stopsimo` (FIFO queue of active streams)

## Volumes and Persistent State

| Path in container | Source on host | Contents |
|---|---|---|
| `/simojs-data/` | `./simojs-data/` | `settings.json`, `macros.js`, `simojs.sqlite`, `html/` output |
| `/templates/` | `./templates/` | HTML templates |
| `/models/` | `./models/` | GGUF model files for llama.cpp |
| `/redis-data/` | `./redis-data/` | Redis RDB persistence |
| `/var/lib/influxdb` | `./influxdb_data/` | InfluxDB time-series data |
