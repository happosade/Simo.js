# Infrastructure

## Docker Services

Defined in `docker-compose.yml` (version 2):

### `simojs` (main bot)
- Built from `Dockerfile` (Debian 10, Node.js v8 via NVM)
- Linked to: `redis`, `pythonsimo`, `influxdb`, `llama`
- Extra host: `host.docker.internal` → host gateway (for reaching host services)
- Bind mounts:
  - `./simojs-data/` → `/simojs-data/` — persistent runtime data
  - `./templates/` → `/templates/` — HTML templates
- Port: `127.0.0.1:9229:9229` (Node.js inspector, local only)
- Restart: always
- Start command: `./repeatSimo` (shell wrapper that loops `node main.js`)

### `pythonsimo`
- Built from `Dockerfile_pythonsimo`
- Exposes port `8888` (internal only — no host binding)
- Linked to: `redis`
- HTTP API: accepts POST `command=<text>&sender=<nick>`, returns plain text
- Restart: always

### `llama`
- Image: `ghcr.io/ggml-org/llama.cpp:server`
- Serves local LLM inference at port `8111`
- Model loaded from `./models/` (GGUF format)
- Default model: `viking-13b-q5_k_m.gguf`
- Config: `--threads 8 --mlock --host 0.0.0.0 --port 8111`
- GPU variant available (commented out in compose) — requires NVIDIA runtime

### `redis`
- Built from `Dockerfile_redis` (custom config via `redis.conf`)
- Bind mount: `./redis-data/` → `/redis-data/`
- Used by pythonsimo for state; potentially also by JS features

### `influxdb`
- Image: `influxdb:latest`
- Container name: `influxdb`
- Database: `simo` (created on first write)
- Bind mount: `./influxdb_data/` → `/var/lib/influxdb`
- Used by `lib/simoInflux.js` to record command invocation metrics

### `ircdjs` (optional)
- Built from `Dockerfile_ircdjs`
- Local IRC server for development — **commented out** in docker-compose by default
- Uncomment to run a fully local dev environment without an external IRC server

## Configuration Files

### `settings.json` (runtime, not committed)

Loaded from `/simojs-data/settings.json` at startup. Template: `settings.json.example`.

```jsonc
{
  "general": {
    "server": "irc.example.com",   // IRC server hostname
    "channels": ["#channel"],       // Channels to join
    "botnick": "SimoBot",
    "username": "name",
    "password": "",
    "port": 6667,
    "websocketport": null           // Optional
  },
  "twitter": { /* API keys */ },
  "translator": { /* Azure Translator credentials */ },
  "wordpress": { "username": "", "password": "" },
  "email": { "fileUrl": "./emailtemplate" },
  "azure": { "vision": "" },
  "openai": { "api_key": "" }       // Added at runtime; not in .example
}
```

### `settings_pythonsimo.cfg` (runtime, not committed)

Config for the Python service. Template: `settings_pythonsimo.cfg.example`.

### `redis.conf`

Custom Redis configuration. Committed to the repo, copied into the Redis container.

### `telegraf.conf`

Telegraf agent configuration for metrics forwarding. Committed to the repo.

## Host-Side Directory Layout

Directories that must exist on the host before running docker-compose:

```
simojs-data/
  settings.json        # required — copied from settings.json.example
  macros.js            # required — JSON object of user macros (start with {})
  simojs.sqlite        # created automatically by TimerDB
  html/                # created automatically; GPT output HTML files live here
models/
  *.gguf               # one or more GGUF model files for llama.cpp
redis-data/            # created automatically
influxdb_data/         # created automatically
```

## Networking

All services communicate over the default Docker bridge network.  
Service names act as hostnames (e.g. `http://pythonsimo:8888`, `http://llama:8111`, `http://influxdb:8086`).  
Only the Node.js inspector port (`9229`) is exposed to the host, and only on `127.0.0.1`.

## Build Notes

The main `Dockerfile` uses an older pattern (Node.js v8 via NVM on Debian 10). Key details:
- `npm install` runs at build time from `package.json`
- Source files are `ADD`ed individually (not with a single `COPY . .`) — a quirk noted in the file
- Running user is `simobot` (UID 1000)
- Entrypoint is `./repeatSimo`, a shell loop that restarts the bot on crash
