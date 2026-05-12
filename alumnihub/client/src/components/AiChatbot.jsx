import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { chatbotService } from "../services/api";
import { useAuth } from "../context/AuthContext";

const STORAGE_PREFIX = "alumnihub_chatbot_history_v1:";

const STUDENT_GREETING = {
  role: "assistant",
  content:
    "Hi! I'm AlumniBot. Ask me anything about AlumniHub, your career path, or how to make the most of the platform.",
};

const ALUMNI_GREETING = {
  role: "assistant",
  content:
    "Welcome back! I'm AlumniBot. Ask me about your job matches, career predictions, networking with other alumni, or any AlumniHub feature.",
};

const STUDENT_PROMPTS = [
  "How do I update my profile?",
  "How does job matching work?",
  "Tips for my first internship?",
  "How can I message an alumni?",
];

const ALUMNI_PROMPTS = [
  "How does Career Prediction work?",
  "How do I upload my CV?",
  "Tips for switching industries?",
  "How do I make my profile private?",
];

function greetingForRole(role) {
  return role === "alumni" ? ALUMNI_GREETING : STUDENT_GREETING;
}

function promptsForRole(role) {
  return role === "alumni" ? ALUMNI_PROMPTS : STUDENT_PROMPTS;
}

function loadHistory(storageKey, greeting) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [greeting];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return [greeting];
  } catch {
    return [greeting];
  }
}

export default function AiChatbot() {
  const { profile } = useAuth();
  const role = profile?.role === "faculty" ? "career_advisor" : profile?.role;

  const greeting = useMemo(() => greetingForRole(role), [role]);
  const quickPrompts = useMemo(() => promptsForRole(role), [role]);
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${role || "guest"}`, [role]);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadHistory(storageKey, greeting));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore quota errors */
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, sending]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    const next = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const history = next
        .filter((m) => m !== greeting)
        .slice(-10, -1);

      const { data } = await chatbotService.sendMessage(trimmed, history);
      const reply = data?.reply?.trim();
      if (!reply) throw new Error("Empty response");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  function handleClear() {
    setMessages([greeting]);
    setError(null);
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chatbot" : "Open chatbot"}
        className={`fixed bottom-6 right-6 z-[9998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-gray-700 hover:bg-gray-800 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[9999] w-[22rem] max-w-[calc(100vw-3rem)] h-[32rem] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">AlumniBot</p>
                <p className="text-[11px] text-blue-100">
                  {role === "alumni" ? "Your alumni assistant" : "Your student assistant"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="text-[11px] text-blue-100 hover:text-white underline-offset-2 hover:underline"
              aria-label="Clear conversation"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.content} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-gray-500 px-2">
                <Loader2 size={14} className="animate-spin" />
                AlumniBot is thinking…
              </div>
            )}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Quick prompts (only when conversation is fresh) */}
          {messages.length <= 1 && !sending && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-100 p-2 flex items-end gap-2 bg-white">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask me anything…"
              rows={1}
              maxLength={2000}
              disabled={sending}
              className="flex-1 resize-none text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 max-h-32"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, text }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
