import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MessageCircle, X, Send, Loader2, Sparkles,
  MessageSquarePlus, ArrowLeft, CheckCircle2,
  Clock, AlertCircle, XCircle, Bug, Lightbulb,
  Flag, HelpCircle, ChevronDown, Star,
} from "lucide-react";
import { chatbotService, feedbackService } from "../services/api";
import { useAuth } from "../context/AuthContext";

/* ─── Chat history persistence ─── */
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

/* ─── Feedback category config ─── */
const CATEGORIES = [
  { value: "bug",        label: "Bug Report",       icon: Bug,        color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200" },
  { value: "feature",    label: "Feature Request",   icon: Lightbulb,  color: "text-amber-500",  bg: "bg-amber-50",  border: "border-amber-200" },
  { value: "complaint",  label: "Complaint",         icon: Flag,       color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  { value: "suggestion", label: "Suggestion",        icon: Star,       color: "text-blue-500",   bg: "bg-blue-50",   border: "border-blue-200" },
  { value: "general",    label: "General Feedback",  icon: HelpCircle, color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200" },
];

const STATUS_CONFIG = {
  pending:  { label: "Pending",  icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
  reviewed: { label: "Reviewed", icon: AlertCircle,   color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200" },
  resolved: { label: "Resolved", icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
  dismissed:{ label: "Dismissed",icon: XCircle,       color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200" },
};

/* ─── Main Component ─── */
export default function AiChatbot() {
  const { profile } = useAuth();
  const role = profile?.role === "faculty" ? "career_advisor" : profile?.role;

  const greeting = useMemo(() => greetingForRole(role), [role]);
  const quickPrompts = useMemo(() => promptsForRole(role), [role]);
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${role || "guest"}`, [role]);

  /* ── Chatbot state ── */
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "support"
  const [messages, setMessages] = useState(() => loadHistory(storageKey, greeting));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  /* ── Support state ── */
  const [supportView, setSupportView] = useState("menu"); // "menu" | "form" | "history" | "detail" | "success"
  const [feedbackCategory, setFeedbackCategory] = useState(null);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const supportScrollRef = useRef(null);

  /* ── Persist chat history ── */
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore quota errors */
    }
  }, [messages, storageKey]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, sending]);

  useEffect(() => {
    if (open && supportScrollRef.current) {
      supportScrollRef.current.scrollTop = 0;
    }
  }, [supportView]);

  /* ── Focus input ── */
  useEffect(() => {
    if (open && activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, activeTab]);

  /* ── Chat send ── */
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

  /* ── Feedback actions ── */
  const loadFeedbackHistory = useCallback(async () => {
    setFeedbackLoading(true);
    setFeedbackError(null);
    try {
      const { data } = await feedbackService.getAll({ limit: 50 });
      setFeedbackList(data.feedback || []);
    } catch {
      setFeedbackError("Could not load feedback history.");
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!feedbackCategory || !feedbackMessage.trim()) return;

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    try {
      await feedbackService.submit({
        category: feedbackCategory,
        subject: feedbackSubject.trim() || null,
        message: feedbackMessage.trim(),
      });
      setSupportView("success");
      // Reset form
      setFeedbackCategory(null);
      setFeedbackSubject("");
      setFeedbackMessage("");
    } catch {
      setFeedbackError("Failed to submit. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  function openFeedbackDetail(item) {
    setSelectedFeedback(item);
    setSupportView("detail");
  }

  function resetSupport() {
    setSupportView("menu");
    setFeedbackCategory(null);
    setFeedbackSubject("");
    setFeedbackMessage("");
    setFeedbackError(null);
    setSelectedFeedback(null);
  }

  /* ── Tab switch ── */
  function switchTab(tab) {
    setActiveTab(tab);
    if (tab === "support") {
      resetSupport();
    }
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
                  {activeTab === "support"
                    ? "Feedback & Support"
                    : role === "alumni"
                    ? "Your alumni assistant"
                    : "Your student assistant"}
                </p>
              </div>
            </div>
            {activeTab === "chat" && (
              <button
                onClick={handleClear}
                className="text-[11px] text-blue-100 hover:text-white underline-offset-2 hover:underline"
                aria-label="Clear conversation"
              >
                Clear
              </button>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => switchTab("chat")}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "chat"
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <MessageCircle size={13} />
                Chat
              </span>
              {activeTab === "chat" && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => switchTab("support")}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "support"
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <MessageSquarePlus size={13} />
                Feedback & Support
              </span>
              {activeTab === "support" && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          </div>

          {/* ════════ CHAT TAB ════════ */}
          {activeTab === "chat" && (
            <>
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
            </>
          )}

          {/* ════════ SUPPORT TAB ════════ */}
          {activeTab === "support" && (
            <div ref={supportScrollRef} className="flex-1 overflow-y-auto bg-gray-50">
              {/* ─── Support Menu ─── */}
              {supportView === "menu" && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    We value your feedback! Help us improve AlumniHub by sharing your thoughts, reporting issues, or suggesting new features.
                  </p>

                  <button
                    onClick={() => setSupportView("form")}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                      <MessageSquarePlus size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Submit Feedback</p>
                      <p className="text-[11px] text-gray-400">Report bugs, suggest features, or share thoughts</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setSupportView("history");
                      loadFeedbackHistory();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">My Submissions</p>
                      <p className="text-[11px] text-gray-400">Track status and admin responses</p>
                    </div>
                  </button>

                  {/* Quick category shortcuts */}
                  <div className="pt-2">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Quick Submit</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CATEGORIES.slice(0, 4).map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.value}
                            onClick={() => {
                              setFeedbackCategory(cat.value);
                              setSupportView("form");
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cat.border} ${cat.bg} hover:opacity-80 transition-all text-left`}
                          >
                            <Icon size={14} className={cat.color} />
                            <span className="text-[11px] font-medium text-gray-700">{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Submit Form ─── */}
              {supportView === "form" && (
                <div className="p-4">
                  <button
                    onClick={resetSupport}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors"
                  >
                    <ArrowLeft size={12} />
                    Back
                  </button>

                  <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                    {/* Category select */}
                    <div>
                      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                        Category *
                      </label>
                      <div className="relative">
                        <select
                          value={feedbackCategory || ""}
                          onChange={(e) => setFeedbackCategory(e.target.value || null)}
                          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none pr-8"
                          required
                        >
                          <option value="">Select a category…</option>
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={feedbackSubject}
                        onChange={(e) => setFeedbackSubject(e.target.value)}
                        placeholder="Brief summary (optional)"
                        maxLength={200}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                        Message *
                      </label>
                      <textarea
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Describe your feedback, issue, or suggestion in detail…"
                        rows={4}
                        maxLength={2000}
                        required
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <p className="text-[10px] text-gray-400 text-right mt-0.5">
                        {feedbackMessage.length}/2000
                      </p>
                    </div>

                    {feedbackError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {feedbackError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={feedbackSubmitting || !feedbackCategory || !feedbackMessage.trim()}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {feedbackSubmitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          Submit Feedback
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* ─── Success Confirmation ─── */}
              {supportView === "success" && (
                <div className="p-6 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Feedback Submitted!</h3>
                  <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-[240px]">
                    Thank you for helping us improve AlumniHub. Our team will review your feedback shortly.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSupportView("form")}
                      className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Submit Another
                    </button>
                    <button
                      onClick={() => {
                        setSupportView("history");
                        loadFeedbackHistory();
                      }}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      View My Submissions
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Feedback History ─── */}
              {supportView === "history" && (
                <div className="p-4">
                  <button
                    onClick={resetSupport}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors"
                  >
                    <ArrowLeft size={12} />
                    Back
                  </button>

                  <h3 className="text-sm font-semibold text-gray-800 mb-3">My Submissions</h3>

                  {feedbackLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-400">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : feedbackError ? (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {feedbackError}
                    </div>
                  ) : feedbackList.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <MessageSquarePlus size={20} className="text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500 mb-3">No feedback submitted yet</p>
                      <button
                        onClick={() => setSupportView("form")}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Submit your first feedback →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {feedbackList.map((item) => {
                        const catConfig = CATEGORIES.find((c) => c.value === item.category) || CATEGORIES[4];
                        const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                        const StatusIcon = statusConfig.icon;
                        const CatIcon = catConfig.icon;

                        return (
                          <button
                            key={item.id}
                            onClick={() => openFeedbackDetail(item)}
                            className="w-full text-left px-3 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`w-7 h-7 rounded-md ${catConfig.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                <CatIcon size={14} className={catConfig.color} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">
                                  {item.subject || catConfig.label}
                                </p>
                                <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                  {item.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
                                    <StatusIcon size={10} />
                                    {statusConfig.label}
                                  </span>
                                  <span className="text-[10px] text-gray-300">
                                    {new Date(item.created_at).toLocaleDateString()}
                                  </span>
                                  {item.admin_response && (
                                    <span className="text-[10px] text-blue-500 font-medium">
                                      💬 Admin replied
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Feedback Detail ─── */}
              {supportView === "detail" && selectedFeedback && (() => {
                const item = selectedFeedback;
                const catConfig = CATEGORIES.find((c) => c.value === item.category) || CATEGORIES[4];
                const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const CatIcon = catConfig.icon;

                return (
                  <div className="p-4">
                    <button
                      onClick={() => setSupportView("history")}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors"
                    >
                      <ArrowLeft size={12} />
                      Back to list
                    </button>

                    {/* Category & status header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg ${catConfig.bg} flex items-center justify-center`}>
                        <CatIcon size={16} className={catConfig.color} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-800">{catConfig.label}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(item.created_at).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
                        <StatusIcon size={10} />
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Subject */}
                    {item.subject && (
                      <div className="mb-3">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Subject</p>
                        <p className="text-sm text-gray-800 font-medium">{item.subject}</p>
                      </div>
                    )}

                    {/* Message */}
                    <div className="mb-3">
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Your Message</p>
                      <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                        {item.message}
                      </div>
                    </div>

                    {/* Admin response */}
                    {item.admin_response && (
                      <div>
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Admin Response</p>
                        <div className="text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                          <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-medium mb-1.5">
                            <MessageCircle size={12} />
                            Admin Team
                          </div>
                          {item.admin_response}
                        </div>
                      </div>
                    )}

                    {!item.admin_response && item.status === "pending" && (
                      <div className="text-center py-4">
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2">
                          <Clock size={18} className="text-amber-500" />
                        </div>
                        <p className="text-xs text-gray-500">Awaiting admin review</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─── Chat Bubble ─── */
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
