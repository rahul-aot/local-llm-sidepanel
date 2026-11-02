# AGENTS.md - LocalMind

Instructions for AI coding agents (and humans) working on **LocalMind**, a Manifest V3 Chrome side panel extension for chatting with Ollama models on the user's machine or local network.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing code. It has diagrams of the components, the message flow, the prompt sent to the model and the stored data. [CONTRIBUTING.md](CONTRIBUTING.md) has the setup and guidelines.

## Layout

```
manifest.json        MV3 manifest: sidePanel, storage, declarativeNetRequestWithHostAccess; host access http(s)://*/*
background.js        Opens the panel on toolbar click; DNR rule that strips Origin from this extension's requests
sidepanel.html       Markup (header, model bar, history drawer + search, messages, input, Settings, Context Inspector)
sidepanel.css        Tokens on :root (light) and :root[data-theme="dark"], then components
sidepanel.js         All app logic (state, storage, Ollama client, readNdjson, buildChatPayload, miner, model manager, theme)
icons/               icon.svg (source) + icon16/48/128.png
build.sh             node --check, manifest check, writes dist/localmind/ and dist/localmind.zip
tests/e2e.cjs        Playwright test that drives the built extension
tests/mock-ollama.cjs  Fake Ollama API; returns 403 when an Origin header is present, like real Ollama
docs/                USER_GUIDE.md (shipped in the build), ARCHITECTURE.md, images/
```

## Commands

```sh
./build.sh                                  # or npm run build
npm test                                    # build + e2e against the mock (what CI runs)
OLLAMA_URL=http://host:11434 npm test       # e2e against a real server
OLLAMA_URL=… E2E_PULL=1 npm test            # also download/remove all-minilm on that server
```

Playwright needs Node 20+ (`.nvmrc` = 22). Debug the panel with right-click → Inspect.

## Rules

1. **No build step, no runtime dependencies.** Plain HTML/CSS/JS loaded directly by Chrome. Dev-only tools are fine.
2. **Privacy.** Only contact the user's configured Ollama server. No telemetry, CDNs or remote fonts. Data stays in `chrome.storage.local`.
3. **Escape everything rendered.** Use `escapeHtml()` or `textContent` for user, model and server text; `formatMarkdown()` escapes before formatting.
4. **Styling.** Use the CSS custom properties. Add every new colour to both the light and the dark token blocks. Check the panel at 360 px wide.
5. **Context correctness.** `buildChatPayload()` is the single source of what the model receives (and of the token counter). Messages flagged `error` and empty placeholders must stay out of it.
6. **Ollama API.** Streaming endpoints (`/api/chat`, `/api/pull`) go through `readNdjson()`. Keep `tests/mock-ollama.cjs` in step with the real API.
7. **Destructive actions** (deleting models from the server) must ask for confirmation.
8. **Tests.** Add a `check(...)` to `tests/e2e.cjs` for new behaviour, and run `npm test` before finishing. Update `CHANGELOG.md` under Unreleased.

## Gotchas

- Chrome sends `Origin: chrome-extension://…` on POST/DELETE, and Ollama answers 403 unless the rule in `background.js` strips it. GET `/api/tags` works either way, so "models load but chat fails" means the rule isn't active. Reload the extension.
- Unpacked extensions get an ID from their folder path, and storage is per ID. Loading a different folder means an empty chat history.
- `manifest.json` or `background.js` changes need a reload in `chrome://extensions`. Panel-only changes need the panel reopened (or Cmd+R in its DevTools).
