# AGENTS.md - LocalMind Side Panel

Guidelines and architecture instructions for AI coding agents and human developers maintaining and extending the **LocalMind** browser extension.

---

## 1. Project Overview & Architecture

**LocalMind** is a Manifest V3 native Chrome / Chromium browser extension that renders inside the browser's native **Side Panel**. It provides an interface to chat with locally hosted Large Language Models (LLMs) such as Ollama or LM Studio, complete with session memory mining and prompt inspection/export.

### Key Architectural Pillars:
1. **Manifest V3 Native Side Panel**: Uses the `chrome.sidePanel` API to dock seamlessly on the right side of any active web tab.
2. **Local / LAN Model Connectivity**: Streams completions directly over HTTP (`/api/chat` for Ollama or `/v1/chat/completions` for OpenAI-compatible endpoints) without relaying data to cloud servers.
3. **Session Memory Miner**: Automatically extracts key persistent facts (user preferences, task context, constraints) across conversation turns and includes them in the system prompt.
4. **Context Transparency & Export**: Users can inspect the exact context payload, token breakdown, and export conversation records as Markdown or JSON.
5. **Zero External Build Step / Vanilla Stack**: Uses standard HTML5, CSS3, and modern ES6 JavaScript. No bundling or transpilation step is required to run or reload.

---

## 2. Directory Structure

```
/Users/rahul/tools/local-llm-sidepanel/
├── manifest.json       # Manifest V3 configuration (permissions, side_panel, host permissions)
├── background.js       # Background service worker (toolbar click handler -> sidePanel.open)
├── sidepanel.html      # Side panel markup (header, chat messages, memory bar, input area, modals)
├── sidepanel.css       # Complete dark-mode design system with variables, animations, responsive layout
├── sidepanel.js        # Core logic: LLM streaming client, memory miner, session storage, UI listeners
├── icons/              # Extension icons (icon16.png, icon48.png, icon128.png)
├── lib/                # Optional standalone helper scripts or dependencies
├── README.md           # User installation, configuration, and feature guide
└── AGENTS.md           # Agent guidelines, code conventions, and maintenance protocols
```

---

## 3. Core Modules & Responsibilities

### `manifest.json`
- Permissions: `sidePanel`, `storage`, `tabs`.
- Host permissions: `http://localhost/*`, `http://127.0.0.1/*`, `http://192.168.*/*`, `http://10.*/*`, `*://*/*`.
- Action config: Automatically registers click behavior.
- Background worker: `background.js`.

### `background.js`
- Sets side panel open behavior:
  ```js
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  ```
- Handles fallback toolbar action events.

### `sidepanel.js`
- **State Management**: Holds `settings`, `sessions`, `currentSessionId`, `availableModels`, `isStreaming`, and `abortController`.
- **Model Discovery**: Queries `${baseUrl}/api/tags` to populate the model picker.
- **Streaming Pipeline**: Uses `fetch()` with `ReadableStream` (`response.body.getReader()`) to parse NDJSON chunks line by line in real time.
- **Memory Miner**: Analyzes incoming messages using rule-based pattern matching (e.g., `"my name is"`, `"prefer"`, `"working on"`, `"remember"`, `"goal is"`) and deduplicates facts stored in session metadata.
- **Context Inspector**: Constructs the exact payload sent to the model and computes approximate token usage based on character/word heuristic (1 token ≈ 4 characters).
- **Export Engine**: Exports active session or full context to `.json` or `.md`.

---

## 4. Coding Standards & Guidelines

1. **No Unnecessary External Dependencies**:
   - Maintain native browser compatibility without npm build steps.
   - Do not introduce heavy bundling frameworks unless explicitly requested by the user.

2. **Error Handling & Resilience**:
   - Always catch connection errors gracefully (e.g., when the local Ollama daemon is paused or unreachable).
   - Display informative status indicators (`Connected`, `Connecting...`, `Disconnected (Ollama offline?)`).

3. **CORS & Local Network Considerations**:
   - When connecting to remote LAN hosts (e.g., `http://192.168.0.x:11434`), ensure Ollama has `OLLAMA_ORIGINS="*"` or includes Chrome extension origins `chrome-extension://*`.

4. **Preserve User Privacy**:
   - All session data, system prompts, and conversation transcripts must remain in `chrome.storage.local`.
   - Never send telemetry or conversation contents to external cloud endpoints.

5. **CSS / UI Styling Rules**:
   - Stick to CSS Custom Properties defined in `:root` inside `sidepanel.css`.
   - Ensure high contrast in dark mode, clear hover feedback, and smooth transitions for all interactive elements.

---

## 5. Development & Testing Workflow

1. **Reloading After Changes**:
   - Code changes in `sidepanel.html`, `sidepanel.css`, or `sidepanel.js` can be refreshed by right-clicking inside the side panel and choosing **Inspect**, then pressing `Cmd+R` / `Ctrl+R`.
   - Manifest or `background.js` modifications require reloading the extension from `chrome://extensions/`.

2. **Debugging**:
   - Open Developer Tools on the side panel by right-clicking anywhere in the panel and selecting **Inspect**.
