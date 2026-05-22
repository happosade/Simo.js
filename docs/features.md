# Feature Plugin System

## How It Works

Every `.js` file in `features/` (except `index.js`) is a **feature plugin**.  
`features/index.js` auto-loads them all at startup and merges their exports into three maps:

| Map | Type | Purpose |
|---|---|---|
| `commands` | `{ "!cmd": [fn, ...] }` | Called when a message starts with `!cmd` |
| `regexes` | `{ key: [fn, ...] }` | Called on every IRC message (for passive listeners) |
| `inits` | `[fn, ...]` | Called once at startup with `(config, client)` |

Multiple features can register the same command — all handlers are called in order.

## Feature Module Contract

```js
// Minimum viable feature
module.exports = {
    commands: {
        '!mycommand': function(client, channel, from, line) {
            // client  – irc-upd client; use client.say(channel, text) to respond
            // channel – IRC channel name (or sender nick for private messages)
            // from    – IRC nick of the message sender
            // line    – full original message, e.g. "!mycommand arg1 arg2"
            client.say(channel, 'Hello from mycommand');
        }
    }
};

// Optional init (runs once at bot start)
module.exports.init = function(config, client) {
    // config – parsed settings.json
    // client – irc-upd client (already created, not yet connected)
};

// Optional regexes
module.exports.regexes = {
    someKey: function(client, channel, from, message) {
        if (/pattern/.test(message)) client.say(channel, 'matched!');
    }
};
```

## Adding a New Feature

1. Copy `features/example.js` to `features/myfeature.js`
2. Export a `commands` map and optionally `init` / `regexes`
3. Restart the bot (or rebuild the container) — `index.js` auto-discovers all files

## Feature Catalogue

| File | Commands | Description |
|---|---|---|
| `aikuisviihde.js` | `!av` | Adult content fetcher |
| `cats.js` | `!cat` | Random cat image |
| `dalle.js` | `!dalle` | OpenAI DALL·E image generation |
| `eval.js` | – | Expression evaluator |
| `example.js` | `!test` | Template / example feature |
| `gallup.js` | `!gallup` | Simple poll helper |
| `janko.js` | – | Janko-related feature |
| `ml-simo.js` | – | Calls the ml-simo microservice |
| `openai.js` | `!gpt`, `!gptclear`, `!gptsystem`, `!gptf`, `!gpti`, `!gptif`, `!gptfp`, `!gpt_raw` | OpenAI Chat Completions; short answers inline, long answers as hosted HTML |
| `protip.js` | `!protip` | Random pro tip |
| `puhu.js` | `!puhu` | Text-to-speech / voice feature |
| `puppulause.js` | – | Finnish random sentence generator |
| `random.js` | `!random`, `!roll`, etc. | Random number / dice utilities |
| `redditor.js` | `!reddit` | Reddit post fetcher |
| `restart-vps.js` | `!restartvps` | Remote VPS restart |
| `restartSeeSharp.js` | `!restartsee#` | Restart a C# service |
| `rockPaperScissors.js` | `!rps` | Rock-paper-scissors game |
| `sandcastle.js` | `!run`, `!addmacro`, `!delmacro`, `!printmacro`, `!listmacros` | Sandboxed JS execution; user macro CRUD |
| `server.js` | – | Express HTTP server (port 8321); exposes `/auth` and `/moro` |
| `simogpt.js` | `!simogpt`, `!simoq`, `!stopsimo` | Streaming local LLM (llama.cpp) with live HTML output |
| `stableDiffusion2.js` | `!sd` | Stable Diffusion image generation |
| `timer.js` | `!timer` | Persistent reminders backed by SQLite |
| `translate.js` | `!translate` | Text translation |
| `twitterStream.js` | `!twitter` | Twitter/X stream listener |
| `uguu.js` | `!uguu` | File upload to uguu.se |
| `unicafe.js` | `!unicafe` | University cafeteria menu |
| `usage.js` | `!usage` | Bot resource-usage stats |
| `xmpp.js` | – | XMPP bridge |

## Macro System (advanced)

User-defined macros extend the command set without deploying code.  
Stored in `/simojs-data/macros.js` (JSON object `{ macroName: scriptBody }`).

| Prefix | Meaning |
|---|---|
| `_` | "pipe" macro — result is concatenated with following arguments |
| `+` | "run" macro — JavaScript evaluated in SandCastle sandbox |
| `*` | "hypermacro" — text substitution in the message pipeline |

Macros are expanded by `main.js` before commands are dispatched.  
`sandcastle.js` provides the `!run` engine and the CRUD commands for `+`/`_` macros.

## pythonsimo Fallback

If a `!command` is not registered in the JS feature set, `MultiCommand` POSTs it to `http://pythonsimo:8888`. This allows features to live in the Python service (`pybase/`) without requiring a JS wrapper. The Python service responds with a plain-text string that is sent back to IRC.
