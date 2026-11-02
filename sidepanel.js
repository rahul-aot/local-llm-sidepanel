/**
 * LocalMind - Side Panel Extension Engine
 * Communicates with local Ollama / LM Studio, mines facts into session memory, streams tokens, exports full context.
 */

// Storage Keys
const STORAGE_KEYS = {
  SESSIONS: "localmind_sessions",
  CURRENT_SESSION_ID: "localmind_current_session_id",
  SETTINGS: "localmind_settings"
};

// Default Settings
const DEFAULT_SETTINGS = {
  baseUrl: "http://192.168.0.13:11434",
  systemPrompt: "You are a concise, helpful local AI assistant. Keep responses clear and structured.",
  contextMiner: true,
  maxHistory: 20
};

// Global Extension State
let state = {
  settings: { ...DEFAULT_SETTINGS },
  sessions: [],
  currentSessionId: null,
  availableModels: [],
  selectedModel: "",
  isStreaming: false,
  abortController: null
};

// DOM Elements
const el = {
  statusBadge: document.getElementById("statusBadge"),
  modelSelect: document.getElementById("modelSelect"),
  refreshModelsBtn: document.getElementById("refreshModelsBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  sidebar: document.getElementById("sidebar"),
  closeSidebarBtn: document.getElementById("closeSidebarBtn"),
  sessionList: document.getElementById("sessionList"),
  clearAllHistoryBtn: document.getElementById("clearAllHistoryBtn"),
  messagesArea: document.getElementById("messagesArea"),
  welcomeCard: document.getElementById("welcomeCard"),
  minedFactsBar: document.getElementById("minedFactsBar"),
  factsPreview: document.getElementById("factsPreview"),
  editMemoryBtn: document.getElementById("editMemoryBtn"),
  chatForm: document.getElementById("chatForm"),
  promptInput: document.getElementById("promptInput"),
  sendBtn: document.getElementById("sendBtn"),
  stopBtn: document.getElementById("stopBtn"),
  tokenCounter: document.getElementById("tokenCounter"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingBaseUrl: document.getElementById("settingBaseUrl"),
  settingSystemPrompt: document.getElementById("settingSystemPrompt"),
  settingContextMiner: document.getElementById("settingContextMiner"),
  settingMaxHistory: document.getElementById("settingMaxHistory"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  exportContextBtn: document.getElementById("exportContextBtn"),
  contextModal: document.getElementById("contextModal"),
  statMessageCount: document.getElementById("statMessageCount"),
  statEstTokens: document.getElementById("statEstTokens"),
  statModel: document.getElementById("statModel"),
  modalMemoryEditor: document.getElementById("modalMemoryEditor"),
  rawContextDisplay: document.getElementById("rawContextDisplay"),
  downloadJsonBtn: document.getElementById("downloadJsonBtn"),
  downloadMdBtn: document.getElementById("downloadMdBtn"),
  copyContextBtn: document.getElementById("copyContextBtn")
};

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadSessions();
  setupEventListeners();
  await refreshModels();
  renderCurrentSession();
});

// Load Settings
async function loadSettings() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
    state.settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
  } else {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  }
  syncSettingsUI();
}

async function saveSettings() {
  state.settings.baseUrl = el.settingBaseUrl.value.trim().replace(/\/$/, "");
  state.settings.systemPrompt = el.settingSystemPrompt.value.trim();
  state.settings.contextMiner = el.settingContextMiner.checked;
  state.settings.maxHistory = parseInt(el.settingMaxHistory.value) || 20;

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: state.settings });
  } else {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
  }
  el.settingsModal.classList.add("hidden");
  await refreshModels();
}

function syncSettingsUI() {
  el.settingBaseUrl.value = state.settings.baseUrl;
  el.settingSystemPrompt.value = state.settings.systemPrompt;
  el.settingContextMiner.checked = state.settings.contextMiner;
  el.settingMaxHistory.value = state.settings.maxHistory;
}

// Session Persistence
async function loadSessions() {
  let stored = null;
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get([STORAGE_KEYS.SESSIONS, STORAGE_KEYS.CURRENT_SESSION_ID]);
    stored = res[STORAGE_KEYS.SESSIONS];
    state.currentSessionId = res[STORAGE_KEYS.CURRENT_SESSION_ID];
  } else {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || "null");
    state.currentSessionId = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION_ID);
  }

  if (Array.isArray(stored) && stored.length > 0) {
    state.sessions = stored;
    if (!state.sessions.find(s => s.id === state.currentSessionId)) {
      state.currentSessionId = state.sessions[0].id;
    }
  } else {
    createNewSession(false);
  }
}

async function persistSessions() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SESSIONS]: state.sessions,
      [STORAGE_KEYS.CURRENT_SESSION_ID]: state.currentSessionId
    });
  } else {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(state.sessions));
    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, state.currentSessionId);
  }
  renderSessionList();
  updateContextStats();
}

function createNewSession(save = true) {
  const newSession = {
    id: "session_" + Date.now(),
    title: "New Conversation",
    createdAt: new Date().toISOString(),
    messages: [],
    minedFacts: []
  };
  state.sessions.unshift(newSession);
  state.currentSessionId = newSession.id;
  if (save) persistSessions();
  renderCurrentSession();
}

function getCurrentSession() {
  return state.sessions.find(s => s.id === state.currentSessionId) || state.sessions[0];
}

// Fetch local Ollama Models
async function refreshModels() {
  el.statusBadge.textContent = "Connecting...";
  el.statusBadge.className = "status-badge";
  el.modelSelect.innerHTML = `<option value="">Checking models...</option>`;

  try {
    const baseUrl = state.settings.baseUrl;
    const res = await fetch(`${baseUrl}/api/tags`, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = data.models || [];

    if (models.length === 0) {
      el.modelSelect.innerHTML = `<option value="">No models on server</option>`;
      el.statusBadge.textContent = "No Models";
      el.statusBadge.className = "status-badge offline";
      return;
    }

    state.availableModels = models.map(m => m.name);
    el.modelSelect.innerHTML = "";
    state.availableModels.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      el.modelSelect.appendChild(opt);
    });

    if (!state.selectedModel || !state.availableModels.includes(state.selectedModel)) {
      state.selectedModel = state.availableModels[0];
    }
    el.modelSelect.value = state.selectedModel;
    el.statusBadge.textContent = "Connected";
    el.statusBadge.className = "status-badge online";
  } catch (err) {
    console.warn("Failed to reach Ollama:", err);
    el.statusBadge.textContent = "Offline";
    el.statusBadge.className = "status-badge offline";
    el.modelSelect.innerHTML = `<option value="">Server offline (${err.message})</option>`;
  }
}

// Context Miner Engine: Discovers facts and user intentions across previous turns
function mineSessionContext(session) {
  if (!state.settings.contextMiner || !session.messages.length) return;

  const facts = session.minedFacts || [];
  const recentUserMsgs = session.messages.filter(m => m.role === "user");
  const lastUserMsg = recentUserMsgs[recentUserMsgs.length - 1]?.content || "";

  const patterns = [
    /(?:my name is|i am|call me)\s+([a-zA-Z0-9_\-\s]+)/i,
    /(?:i prefer|i like|i want|prefer using|always use)\s+([^\.\n]+)/i,
    /(?:working on|building|creating|developing)\s+([^\.\n]+)/i,
    /(?:in python|in javascript|in go|in rust|in typescript|using\s+[a-zA-Z0-9_\-]+)/i
  ];

  patterns.forEach(p => {
    const match = lastUserMsg.match(p);
    if (match) {
      const fact = match[0].trim();
      if (!facts.includes(fact) && fact.length < 120) {
        facts.push(fact);
      }
    }
  });

  session.minedFacts = facts.slice(-10);
  updateMinedFactsBar();
}

function updateMinedFactsBar() {
  const session = getCurrentSession();
  if (session && session.minedFacts && session.minedFacts.length > 0) {
    el.minedFactsBar.classList.remove("hidden");
    el.factsPreview.textContent = session.minedFacts.join(" • ");
  } else {
    el.minedFactsBar.classList.add("hidden");
  }
}

// Build Payload for local LLM
function buildChatPayload(session, newPrompt) {
  const messagesToSend = [];

  let fullSystemPrompt = state.settings.systemPrompt || "";
  if (session.minedFacts && session.minedFacts.length > 0) {
    fullSystemPrompt += `\n[Known context & preferences from previous exchanges]:\n- ` + session.minedFacts.join("\n- ");
  }

  if (fullSystemPrompt.trim()) {
    messagesToSend.push({ role: "system", content: fullSystemPrompt.trim() });
  }

  const maxHistory = state.settings.maxHistory || 20;
  const recentHistory = session.messages.slice(-maxHistory);
  for (const m of recentHistory) {
    messagesToSend.push({ role: m.role, content: m.content });
  }

  if (newPrompt) {
    messagesToSend.push({ role: "user", content: newPrompt });
  }

  return messagesToSend;
}

// Chat Send & Live Streaming
async function handleSendMessage(e) {
  if (e) e.preventDefault();
  const prompt = el.promptInput.value.trim();
  if (!prompt || state.isStreaming) return;

  const session = getCurrentSession();
  const model = el.modelSelect.value || state.selectedModel;

  if (!model) {
    alert("Please ensure your local LLM server is reachable and a model is chosen.");
    return;
  }

  const userMessage = { role: "user", content: prompt, timestamp: new Date().toISOString() };
  session.messages.push(userMessage);

  if (session.messages.length === 1) {
    session.title = prompt.slice(0, 30) + (prompt.length > 30 ? "..." : "");
  }

  mineSessionContext(session);

  el.promptInput.value = "";
  el.promptInput.style.height = "auto";
  renderMessages();

  const assistantMsgObj = { role: "assistant", content: "", timestamp: new Date().toISOString() };
  session.messages.push(assistantMsgObj);

  const assistantBubble = appendStreamingBubble();
  setStreamingState(true);

  state.abortController = new AbortController();
  const payload = {
    model: model,
    messages: buildChatPayload(session, prompt),
    stream: true
  };

  try {
    const baseUrl = state.settings.baseUrl;
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: state.abortController.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned HTTP ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.error) throw new Error(parsed.error);
          const piece = parsed.message?.content || "";
          accumulatedText += piece;
          assistantBubble.innerHTML = formatMarkdown(accumulatedText) + `<span class="cursor-blink"></span>`;
          el.messagesArea.scrollTop = el.messagesArea.scrollHeight;
        } catch (jsonErr) {}
      }
    }

    assistantMsgObj.content = accumulatedText;
    assistantBubble.innerHTML = formatMarkdown(accumulatedText);
  } catch (err) {
    if (err.name === "AbortError") {
      assistantBubble.innerHTML += `<div style="color:var(--text-muted);font-size:11px;margin-top:4px;">(Stopped)</div>`;
    } else {
      assistantBubble.innerHTML = `<span style="color:var(--danger)">⚠️ Error: ${err.message}</span>`;
      assistantMsgObj.content = `[Error: ${err.message}]`;
    }
  } finally {
    setStreamingState(false);
    await persistSessions();
    el.messagesArea.scrollTop = el.messagesArea.scrollHeight;
  }
}

function setStreamingState(streaming) {
  state.isStreaming = streaming;
  if (streaming) {
    el.sendBtn.classList.add("hidden");
    el.stopBtn.classList.remove("hidden");
  } else {
    el.sendBtn.classList.remove("hidden");
    el.stopBtn.classList.add("hidden");
  }
}

function stopStreaming() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
}

// Markdown Formatter
function formatMarkdown(text) {
  if (!text) return "";
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="lang-${lang}">${code}</code></pre>`;
  });
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/\n/g, "<br>");
  return escaped;
}

// Render UI
function renderCurrentSession() {
  const session = getCurrentSession();
  if (!session) return;

  renderMessages();
  renderSessionList();
  updateMinedFactsBar();
  updateContextStats();
}

function renderMessages() {
  const session = getCurrentSession();
  el.messagesArea.innerHTML = "";

  if (!session || session.messages.length === 0) {
    el.messagesArea.appendChild(el.welcomeCard);
    return;
  }

  session.messages.forEach(msg => {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${msg.role}`;
    msgDiv.innerHTML = `
      <div class="message-bubble">${msg.role === 'assistant' ? formatMarkdown(msg.content) : escapeHtml(msg.content)}</div>
      <div class="message-meta">
        <span>${msg.role === 'user' ? 'You' : (el.modelSelect.value || 'AI')}</span>
        <span>${new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `;
    el.messagesArea.appendChild(msgDiv);
  });

  el.messagesArea.scrollTop = el.messagesArea.scrollHeight;
}

function appendStreamingBubble() {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message assistant";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = `<span class="cursor-blink"></span>`;
  msgDiv.appendChild(bubble);
  el.messagesArea.appendChild(msgDiv);
  el.messagesArea.scrollTop = el.messagesArea.scrollHeight;
  return bubble;
}

function renderSessionList() {
  el.sessionList.innerHTML = "";
  state.sessions.forEach(s => {
    const item = document.createElement("div");
    item.className = `session-item ${s.id === state.currentSessionId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="session-title" title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</span>
      <span class="session-delete" title="Delete chat">&times;</span>
    `;

    item.querySelector(".session-title").addEventListener("click", () => {
      state.currentSessionId = s.id;
      persistSessions();
      renderCurrentSession();
      el.sidebar.classList.add("hidden");
    });

    item.querySelector(".session-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(s.id);
    });

    el.sessionList.appendChild(item);
  });
}

function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.sessions.length === 0) {
    createNewSession(false);
  } else if (state.currentSessionId === id) {
    state.currentSessionId = state.sessions[0].id;
  }
  persistSessions();
  renderCurrentSession();
}

function updateContextStats() {
  const session = getCurrentSession();
  if (!session) return;
  const count = session.messages.length;
  const charCount = session.messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
  const approxTokens = Math.round(charCount / 4);
  el.tokenCounter.textContent = `~${approxTokens} tokens (${count} msgs)`;
}

// Full Context Inspector & Exporter
function openContextModal() {
  const session = getCurrentSession();
  if (!session) return;

  const charCount = session.messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
  const approxTokens = Math.round(charCount / 4);

  el.statMessageCount.textContent = `${session.messages.length} Messages`;
  el.statEstTokens.textContent = `~${approxTokens} Tokens`;
  el.statModel.textContent = `Model: ${el.modelSelect.value || state.selectedModel || 'None'}`;

  el.modalMemoryEditor.value = (session.minedFacts || []).join("\n");

  const fullPayload = buildChatPayload(session, "");
  el.rawContextDisplay.textContent = JSON.stringify(fullPayload, null, 2);

  el.contextModal.classList.remove("hidden");
}

function downloadSession(format) {
  const session = getCurrentSession();
  if (!session) return;

  let content = "";
  let mimeType = "text/plain";
  let filename = `chat_${session.id}`;

  if (format === "json") {
    content = JSON.stringify(session, null, 2);
    mimeType = "application/json";
    filename += ".json";
  } else if (format === "md") {
    content = `# ${session.title}\n\n*Date: ${session.createdAt}*\n\n`;
    if (session.minedFacts && session.minedFacts.length > 0) {
      content += `### 🧠 Mined Session Facts\n${session.minedFacts.map(f => `- ${f}`).join("\n")}\n\n`;
    }
    content += `---\n\n`;
    session.messages.forEach(m => {
      content += `### ${m.role === 'user' ? 'User' : 'Assistant'}\n${m.content}\n\n`;
    });
    filename += ".md";
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Event Listeners
function setupEventListeners() {
  el.modelSelect.addEventListener("change", (e) => {
    state.selectedModel = e.target.value;
  });
  el.refreshModelsBtn.addEventListener("click", refreshModels);

  el.newChatBtn.addEventListener("click", () => createNewSession(true));

  el.toggleSidebarBtn.addEventListener("click", () => el.sidebar.classList.toggle("hidden"));
  el.closeSidebarBtn.addEventListener("click", () => el.sidebar.classList.add("hidden"));
  el.clearAllHistoryBtn.addEventListener("click", () => {
    if (confirm("Delete all chat sessions?")) {
      state.sessions = [];
      createNewSession(true);
    }
  });

  el.promptInput.addEventListener("input", () => {
    el.promptInput.style.height = "auto";
    el.promptInput.style.height = Math.min(el.promptInput.scrollHeight, 140) + "px";
  });
  el.promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  el.chatForm.addEventListener("submit", handleSendMessage);
  el.stopBtn.addEventListener("click", stopStreaming);

  el.openSettingsBtn.addEventListener("click", () => {
    syncSettingsUI();
    el.settingsModal.classList.remove("hidden");
  });
  el.saveSettingsBtn.addEventListener("click", saveSettings);

  el.exportContextBtn.addEventListener("click", openContextModal);
  el.editMemoryBtn.addEventListener("click", openContextModal);

  el.modalMemoryEditor.addEventListener("change", () => {
    const session = getCurrentSession();
    if (session) {
      session.minedFacts = el.modalMemoryEditor.value.split("\n").map(f => f.trim()).filter(Boolean);
      persistSessions();
      updateMinedFactsBar();
    }
  });

  el.downloadJsonBtn.addEventListener("click", () => downloadSession("json"));
  el.downloadMdBtn.addEventListener("click", () => downloadSession("md"));
  el.copyContextBtn.addEventListener("click", () => {
    const text = el.rawContextDisplay.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const orig = el.copyContextBtn.textContent;
      el.copyContextBtn.textContent = "Copied!";
      setTimeout(() => el.copyContextBtn.textContent = orig, 1500);
    });
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-close");
      document.getElementById(targetId)?.classList.add("hidden");
    });
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
