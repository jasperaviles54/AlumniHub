const { Router } = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { authenticate, authorize } = require("../middleware/auth.js");
const { supabase } = require("../config/supabase.js");

const router = Router();

const BASE_PROMPT = `You are AlumniBot, a friendly and helpful assistant inside AlumniHub — an alumni tracking and career platform at the Technological Institute of the Philippines.

Style guidelines:
- Be warm, concise, and encouraging — talk like a supportive senior, not a corporate FAQ.
- Keep replies short (2–5 sentences) unless the user asks for detail.
- When pointing to a feature, mention the sidebar item by name (e.g. "Jobs", "My Profile", "Inbox").
- If asked something outside scope (homework, unrelated topics), politely steer back to career/AlumniHub topics.
- Never invent platform features. If unsure, suggest contacting a career advisor via the Inbox.
- Do not provide medical, legal, or financial advice — suggest seeing a professional instead.`;

const STUDENT_FEATURES = `You are talking to a STUDENT. They have access to:
- My Profile, Jobs, Inbox, Career Advice (notes & recommendations from their advisor), Settings.
You can help with: how to use these features, career guidance (resumes, interviews, skill-building, choosing a path), connecting with alumni and advisors.`;

const ALUMNI_FEATURES = `You are talking to an ALUMNI. They have access to:
- My Profile (with CV upload — the system AI-extracts career milestones and skills),
- Jobs (with AI Smart Job Matching that ranks postings by skills, industry, experience, program),
- Inbox + Message Requests (private profiles require a request before messaging),
- Career Prediction (peer-based trajectory analysis),
- Settings (including the privacy toggle for hiding their profile from other alumni).
You can help with: how to use these features, professional growth, networking with other alumni, mentoring students, interpreting their career prediction or job matches, and updating their profile or CV.`;

function systemPromptForRole(role) {
  const roleBlock = role === "alumni" ? ALUMNI_FEATURES : STUDENT_FEATURES;
  return `${BASE_PROMPT}\n\n${roleBlock}`;
}

function getApiKeys() {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter(Boolean);
}

async function callGeminiChat(history, userMessage, userContext, role) {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("No GEMINI_API_KEY configured.");

  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
  const systemInstruction =
    systemPromptForRole(role) +
    (userContext ? `\n\nUser context (use only if relevant):\n${userContext}` : "");

  let lastError;
  for (const modelName of MODELS) {
    for (const key of keys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
        });
        const chat = model.startChat({
          history: history.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        });
        const result = await chat.sendMessage(userMessage);
        return result.response.text().trim();
      } catch (err) {
        lastError = err;
        const msg = (err.message ?? "").toLowerCase();
        const isTransient =
          msg.includes("quota") || msg.includes("rate") ||
          msg.includes("exhausted") || msg.includes("429") ||
          msg.includes("503") || msg.includes("unavailable") ||
          msg.includes("overloaded") || msg.includes("high demand") ||
          msg.includes("try again") || err.status === 429 || err.status === 503;
        if (!isTransient) throw err;
      }
    }
  }
  throw lastError;
}

function buildUserContext(profile) {
  if (!profile) return "";
  const parts = [];
  if (profile.first_name) parts.push(`Name: ${profile.first_name}`);
  if (profile.program) parts.push(`Program: ${profile.program}`);
  if (profile.role === "student" && profile.year_level) {
    parts.push(`Year level: ${profile.year_level}`);
  }
  if (profile.role === "alumni") {
    if (profile.graduation_year) parts.push(`Graduation year: ${profile.graduation_year}`);
    if (profile.current_job_title) parts.push(`Current role: ${profile.current_job_title}`);
    if (profile.industry) parts.push(`Industry: ${profile.industry}`);
  }
  if (Array.isArray(profile.skills) && profile.skills.length) {
    parts.push(`Skills: ${profile.skills.slice(0, 10).join(", ")}`);
  }
  return parts.join("\n");
}

// ── POST /api/chatbot/message
// Body: { message: string, history?: [{ role: "user"|"assistant", content: string }] }
router.post("/message", authenticate, authorize("student", "alumni"), async (req, res, next) => {
  try {
    const { message, history } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "message too long (max 2000 chars)" });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
          .slice(-10)
      : [];

    const userContext = buildUserContext(req.profile);

    let reply;
    try {
      reply = await callGeminiChat(safeHistory, message.trim(), userContext, req.profile?.role);
    } catch (err) {
      console.error("[chatbot] Gemini error:", err.message);
      return res.status(503).json({
        error: "The chatbot is unavailable right now. Please try again in a moment.",
      });
    }

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
