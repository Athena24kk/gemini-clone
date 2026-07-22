import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Plus,
  Menu,
  Mic,
  Image as ImageIcon,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Search,
  Settings,
  Trash2,
  Check,
  Paperclip,
  Square,
} from "lucide-react";

/*
  ==================================================================
  FULL-FLEDGED GEMINI-STYLE CHAT APP
  ==================================================================
  A close recreation of the Google Gemini web UI: collapsible history
  sidebar, model picker, streaming (typewriter) responses, markdown-lite
  rendering (bold, code blocks, lists), copy/regenerate/like/dislike
  actions, multi-chat history, and a welcome screen with suggestions.

  RESPONSES ARE REAL. This app calls a live large language model
  (Claude, via the API access built into this environment) to answer
  your questions, so replies are genuinely generated, not canned demo
  text. Note this is NOT literally Google's Gemini model — that API
  requires your own Google API key and a server to call it safely from
  (a browser can't hold that key without exposing it). The UI, however,
  is a full Gemini-style clone, and swapping the model underneath is a
  one-function change if you'd rather wire up real Gemini:

  1) Get a key: https://aistudio.google.com
  2) Stand up a backend route that holds the key server-side and calls
     `genAI.getGenerativeModel({ model: "gemini-2.0-flash" })`
  3) Point `getRealAIReply` below at that route instead of the built-in
     Anthropic endpoint. Everything else (UI, streaming, history) stays
     the same.
  ==================================================================
*/

const MODELS = [
  { id: "flash", name: "Gemini 2.5 Flash", desc: "Fast on everyday tasks" },
  { id: "pro", name: "Gemini 2.5 Pro", desc: "Best for complex reasoning" },
];

const SUGGESTIONS = [
  { icon: "✨", title: "Explain a concept", subtitle: "like quantum computing, simply", color: "from-blue-500/20 to-blue-500/5" },
  { icon: "📝", title: "Write something", subtitle: "a short story about the sea", color: "from-purple-500/20 to-purple-500/5" },
  { icon: "💡", title: "Brainstorm ideas", subtitle: "for a weekend side project", color: "from-amber-500/20 to-amber-500/5" },
  { icon: "🧮", title: "Help me solve", subtitle: "a tricky math problem", color: "from-teal-500/20 to-teal-500/5" },
];

// ---------- AI backend ----------
// This calls your local backend (server.js), which holds your real Gemini
// API key server-side and forwards the request to Google's Gemini API.
// `history` is the prior turns as [{role: "user"|"assistant", content}].
async function getRealAIReply(history) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed with status ${response.status}`);
  }
  const data = await response.json();
  return data.text;
}

// Streams the real reply into the UI word-by-word so it still feels live,
// even though the underlying call itself isn't a token stream.
async function streamAIResponse(history, onChunk, signal) {
  let full;
  try {
    full = await getRealAIReply(history);
  } catch (err) {
    full = `Sorry, I couldn't reach the AI backend (${err.message}). Please try again.`;
  }
  const words = full.split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) return;
    onChunk(words[i]);
    await new Promise((r) => setTimeout(r, 8 + Math.random() * 10));
  }
}

// ---------- Minimal markdown renderer (bold, code blocks, inline code, lists) ----------
function MarkdownText({ text }) {
  const blocks = text.split(/```/);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          const lines = block.split("\n");
          const lang = lines[0].trim();
          const code = lines.slice(lang ? 1 : 0).join("\n");
          return (
            <pre
              key={i}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 overflow-x-auto text-[13px] font-mono text-neutral-200"
            >
              <code>{code}</code>
            </pre>
          );
        }
        return (
          <div key={i}>
            {block
              .split("\n")
              .filter((l, idx, arr) => !(l === "" && (idx === 0 || idx === arr.length - 1)))
              .map((line, j) => {
                const listMatch = line.match(/^-\s+(.*)/);
                const numMatch = line.match(/^(\d+)\.\s+(.*)/);
                const content = listMatch ? listMatch[1] : numMatch ? numMatch[2] : line;
                const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
                const rendered = parts.map((part, k) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                      <strong key={k} className="font-medium text-neutral-50">
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  if (part.startsWith("`") && part.endsWith("`")) {
                    return (
                      <code
                        key={k}
                        className="bg-neutral-800 text-amber-300 px-1.5 py-0.5 rounded text-[13px] font-mono"
                      >
                        {part.slice(1, -1)}
                      </code>
                    );
                  }
                  return <React.Fragment key={k}>{part}</React.Fragment>;
                });
                if (listMatch) {
                  return (
                    <div key={j} className="flex gap-2 pl-1 leading-relaxed">
                      <span className="text-neutral-500">•</span>
                      <span>{rendered}</span>
                    </div>
                  );
                }
                if (numMatch) {
                  return (
                    <div key={j} className="flex gap-2 pl-1 leading-relaxed">
                      <span className="text-neutral-500">{numMatch[1]}.</span>
                      <span>{rendered}</span>
                    </div>
                  );
                }
                if (line.trim() === "") return <div key={j} className="h-2" />;
                return (
                  <p key={j} className="leading-relaxed">
                    {rendered}
                  </p>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

function GeminiMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 8 8 12 2 12C8 12 12 16 12 22C12 16 16 12 22 12C16 12 12 8 12 2Z"
        fill="url(#gm)"
      />
      <defs>
        <linearGradient id="gm" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#F28C38" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Avatar({ role }) {
  if (role === "user") {
    return (
      <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] font-medium text-white shrink-0">
        You
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
      <GeminiMark size={16} />
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
      aria-label="Copy response"
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

let idCounter = 1;
const nextId = () => idCounter++;

export default function GeminiFullApp() {
  const [chats, setChats] = useState(() => {
    const id = nextId();
    return [{ id, title: "New chat", messages: [] }];
  });
  const [activeChatId, setActiveChatId] = useState(chats[0].id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState(MODELS[0]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? chats[0];
  const messages = activeChat.messages;

  const updateChat = useCallback((chatId, updater) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? updater(c) : c)));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const runAssistantReply = async (chatId, conversationSoFar) => {
    const assistantId = nextId();
    updateChat(chatId, (c) => ({
      ...c,
      messages: [...c.messages, { role: "assistant", content: "", id: assistantId, streaming: true }],
    }));
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const apiHistory = conversationSoFar
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await streamAIResponse(
        apiHistory,
        (chunk) => {
          updateChat(chatId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            ),
          }));
        },
        controller.signal
      );
    } finally {
      updateChat(chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
      }));
      setLoading(false);
      abortRef.current = null;
    }
  };

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const chatId = activeChatId;
    const userMsg = { role: "user", content, id: nextId() };

    const newMessages = [...messages, userMsg];
    updateChat(chatId, (c) => ({
      ...c,
      messages: newMessages,
      title: c.title === "New chat" ? content.slice(0, 32) + (content.length > 32 ? "…" : "") : c.title,
    }));
    setInput("");

    await runAssistantReply(chatId, newMessages);
  };

  const regenerate = async (assistantMsgId) => {
    if (loading) return;
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    const conversationUpTo = messages.slice(0, idx);
    if (conversationUpTo.length === 0 || conversationUpTo[conversationUpTo.length - 1].role !== "user") return;
    updateChat(activeChatId, (c) => ({
      ...c,
      messages: c.messages.filter((m) => m.id !== assistantMsgId),
    }));
    await runAssistantReply(activeChatId, conversationUpTo);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    const id = nextId();
    setChats((prev) => [{ id, title: "New chat", messages: [] }, ...prev]);
    setActiveChatId(id);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const newId = nextId();
        const fresh = [{ id: newId, title: "New chat", messages: [] }];
        setActiveChatId(newId);
        return fresh;
      }
      if (id === activeChatId) setActiveChatId(next[0].id);
      return next;
    });
  };

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[680px] w-full bg-neutral-950 text-neutral-100 rounded-2xl overflow-hidden border border-neutral-800 font-sans text-[15px]">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-200 overflow-hidden bg-neutral-925 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0`}
      >
        <div className="p-3 space-y-2">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-full border border-neutral-700 hover:bg-neutral-800 text-sm transition-colors"
          >
            <Plus size={16} />
            New chat
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-800/60 border border-neutral-800">
            <Search size={14} className="text-neutral-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              className="bg-transparent outline-none text-sm flex-1 placeholder-neutral-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <div className="px-3 py-1 text-xs text-neutral-500 font-medium">Recent</div>
          {filteredChats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChatId(c.id)}
              className={`group w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                c.id === activeChatId
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-800/60"
              }`}
            >
              <span className="truncate flex-1">{c.title}</span>
              <span
                onClick={(e) => deleteChat(c.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-700 shrink-0 transition-opacity"
                aria-label="Delete chat"
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))}
          {filteredChats.length === 0 && (
            <div className="px-3 py-4 text-xs text-neutral-600">No chats found.</div>
          )}
        </div>

        <div className="p-3 border-t border-neutral-800">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:bg-neutral-800/60 transition-colors">
            <Settings size={15} />
            Settings and help
          </button>
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="p-2 rounded-full hover:bg-neutral-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-1.5">
              <GeminiMark size={20} />
              <span className="font-medium text-lg tracking-tight">Gemini</span>
            </div>

            {/* Model selector */}
            <div className="relative ml-2">
              <button
                onClick={() => setModelMenuOpen((o) => !o)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-neutral-800 text-sm text-neutral-300 transition-colors"
              >
                {model.name}
                <ChevronDown size={14} className={`transition-transform ${modelMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {modelMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl z-20 overflow-hidden">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m);
                        setModelMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-neutral-800 transition-colors flex items-start justify-between gap-2 ${
                        m.id === model.id ? "bg-neutral-800/60" : ""
                      }`}
                    >
                      <div>
                        <div className="text-sm">{m.name}</div>
                        <div className="text-xs text-neutral-500">{m.desc}</div>
                      </div>
                      {m.id === model.id && <Check size={15} className="mt-0.5 text-blue-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-medium">
            U
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center gap-8">
              <h1 className="text-4xl font-medium bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">
                Hello, explorer
              </h1>
              <p className="text-neutral-400 -mt-6">How can I help you today?</p>
              <div className="grid grid-cols-2 gap-3 w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(`${s.title} ${s.subtitle}`)}
                    className={`text-left p-4 rounded-2xl bg-gradient-to-br ${s.color} border border-neutral-800 hover:border-neutral-700 transition-colors`}
                  >
                    <div className="text-xl mb-3">{s.icon}</div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-neutral-400 mt-1">{s.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <Avatar role={m.role} />
                  <div className="flex-1 min-w-0 pt-1">
                    {m.role === "assistant" && m.content === "" && m.streaming ? (
                      <div className="flex gap-1 items-center py-2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    ) : m.role === "assistant" ? (
                      <MarkdownText text={m.content} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    )}

                    {m.role === "assistant" && !m.streaming && m.content && (
                      <div className="flex items-center gap-1 mt-3 -ml-1.5">
                        <CopyButton text={m.content} />
                        <button
                          onClick={() => regenerate(m.id)}
                          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                          aria-label="Regenerate response"
                        >
                          <RefreshCw size={15} />
                        </button>
                        <button
                          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                          aria-label="Good response"
                        >
                          <ThumbsUp size={15} />
                        </button>
                        <button
                          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                          aria-label="Bad response"
                        >
                          <ThumbsDown size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto flex items-end gap-1.5 bg-neutral-900 border border-neutral-700 rounded-3xl px-3 py-2 focus-within:border-neutral-500 transition-colors">
            <button className="p-2 text-neutral-400 hover:text-white transition-colors" aria-label="Attach file">
              <Paperclip size={18} />
            </button>
            <button className="p-2 text-neutral-400 hover:text-white transition-colors" aria-label="Add image">
              <ImageIcon size={18} />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask Gemini anything...`}
              className="flex-1 bg-transparent resize-none outline-none text-[15px] placeholder-neutral-500 py-2 max-h-40"
            />
            <button className="p-2 text-neutral-400 hover:text-white transition-colors" aria-label="Voice input">
              <Mic size={18} />
            </button>
            {loading ? (
              <button
                onClick={stopStreaming}
                className="p-2 rounded-full bg-neutral-200 text-neutral-900 hover:bg-white transition-colors"
                aria-label="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className={`p-2 rounded-full transition-colors ${
                  input.trim()
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "bg-neutral-800 text-neutral-600"
                }`}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-neutral-500 mt-2">
            Gemini can make mistakes, so double-check important info.
          </p>
        </div>
      </div>
    </div>
  );
}
