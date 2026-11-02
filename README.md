# LocalMind - Browser Side Panel for Local LLMs

A Chrome / Brave / Edge extension that docks as a native **Side Panel** (just like Quipo AI Scribe side panel), enabling you to chat with local LLMs (Ollama / LM Studio) alongside any browser tab.

```
📁 Project Path: /Users/rahul/tools/local-llm-sidepanel
```

---

## 🚀 Key Features

1. **Native Chrome Side Panel**:
   - Opens seamlessly in your browser's native side panel when clicking the toolbar action.
   - Stays persistent and docked alongside your active tabs while browsing.

2. **Local LLM Connectivity**:
   - Default configured for `http://192.168.0.13:11434` (Ollama LAN host) or `http://localhost:11434`.
   - Dynamic model auto-discovery (`/api/tags`) with dropdown selection.
   - Real-time token streaming with cancel/abort controls.

3. **🧠 Session Memory & Context Miner**:
   - Automatically detects user goals, preferences, active tasks, and environment details.
   - Automatically summarizes and injects mined facts into the active system prompt.
   - Interactive memory bar allows you to inspect, add, edit, or delete remembered facts in real time.

4. **🔍 Context Inspector & Full Export**:
   - View the exact JSON payload and message array sent to your model.
   - Live token estimation counter.
   - Export chat history and context to **Markdown (`.md`)** or **JSON (`.json`)**.
   - Copy context payload directly to clipboard.

5. **💾 Local Persistence & Multi-Session Support**:
   - Conversations and settings are stored locally in Chrome's extension storage (`chrome.storage.local`).
   - Create, switch, and delete sessions from the session sidebar drawer.

---

## 🛠️ Installation into Chrome / Brave / Edge

1. Open your browser and navigate to:
   ```text
   chrome://extensions/
   ```
   *(or `brave://extensions/` / `edge://extensions/`)*
2. In the top right corner, switch on **"Developer mode"**.
3. In the top left corner, click **"Load unpacked"**.
4. Select the directory:
   ```text
   /Users/rahul/tools/local-llm-sidepanel
   ```
5. Pin the extension to your toolbar, click the icon, and the side panel will slide open on the right!

---

## ⚙️ Configuration

Click the **Settings** (⚙️) icon in the top header to configure:
- **Ollama API URL**: Change between `http://192.168.0.13:11434` or `http://localhost:11434`.
- **System Prompt**: Set instructions, personality, or default behavioral constraints.
- **Context Miner**: Enable or disable automatic memory mining.
- **Max History Turns**: Control how many previous turns are sent per request.

### Ollama CORS Setup (If connecting over LAN)
If accessing Ollama hosted on another machine, make sure the Ollama service allows web requests:
```bash
# On the machine hosting Ollama:
OLLAMA_ORIGINS="*" ollama serve
```

---

## 📁 Repository Structure

```
.
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── background.js       # Background service worker (side panel behavior)
├── sidepanel.html      # UI structure (chat, memory bar, drawers, modals)
├── sidepanel.css       # Dark-mode styling, animations, responsive layout
├── sidepanel.js        # Chat engine, streaming client, memory miner, export
├── icons/              # Extension icons (16px, 48px, 128px)
├── README.md           # User documentation and guide
└── AGENTS.md           # Developer & AI agent specifications and architecture
```
