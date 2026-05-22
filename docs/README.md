# Simo.js – Project Documentation

Simo.js is an IRC bot written in Node.js with a plugin-based feature architecture. It connects to IRC channels, responds to commands prefixed with `!`, runs regex-triggered responses, fetches URL titles automatically, and integrates with multiple AI models and external services.

## Quick Navigation

| Document | Purpose |
|---|---|
| [architecture.md](./architecture.md) | System design, service graph, message flow |
| [features.md](./features.md) | How the feature plugin system works; feature catalogue |
| [infrastructure.md](./infrastructure.md) | Docker services, volumes, configuration |
| [AGENTS.md](./AGENTS.md) | Guide for AI coding agents working in this codebase |

## What It Does

- Connects to one or more IRC channels via `irc-upd`
- Dispatches `!commands` to registered feature handlers
- Chains commands using a **hypermacro** system (stored in `/simojs-data/macros.js`)
- Fetches and prints web page titles for any URL pasted in chat
- Polls a SQLite database for scheduled timer reminders
- Integrates with OpenAI (GPT), a local LLaMA.cpp server, Twitter, XMPP, and other services
- Emits metrics to InfluxDB for monitoring

## Getting Started

```bash
# 1. Clone the repo
# 2. Copy and fill in settings
cp settings.json.example simojs-data/settings.json
cp settings_pythonsimo.cfg.example simojs-data/settings_pythonsimo.cfg

# 3. Start services
docker-compose up
```

All logs go to container stdout; use `docker-compose logs --follow` to tail them.

## Repository Layout (top level)

```
main.js                 Entry point — IRC client setup, feature loading, message dispatch
features/               Feature plugins (each file = one plugin)
lib/                    Shared utilities used by main.js and features
macros/                 Seed macro files
ml-simo/                Standalone ML microservice (Python, separate compose)
pybase/                 Python base Dockerfile for pythonsimo
resources/              Static assets served by the express server feature
templates/              HTML templates for streamed LLM output
Dockerfile              Main simojs container
Dockerfile_*            Per-service Dockerfiles
docker-compose.yml      Full service orchestration
settings.json.example   Config template
telegraf.conf           Telegraf metrics collection config
simojs.sqlite           Dev copy of the timer database (bind-mounted at runtime)
```
