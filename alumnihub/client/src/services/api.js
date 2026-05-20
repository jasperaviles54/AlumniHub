import axios from "axios";
import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL || "/api";

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach Supabase token to every request
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ── Auth ──
export const authService = {
  signUp: (email, password, metadata) =>
    supabase.auth.signUp({ email, password, options: { data: metadata } }),
  signIn: (email, password) =>
    supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
  getSession: () => supabase.auth.getSession(),
};

// ── Profiles ──
export const profileService = {
  getMyProfile: () => api.get("/profiles/me"),
  updateProfile: (data) => api.put("/profiles/me", data),
  togglePrivacy: (isPrivate) => api.put("/profiles/me", { is_private: isPrivate }),
  getAlumniList: (params) => api.get("/profiles/alumni", { params }),
  getProfileById: (id) => api.get(`/profiles/${id}`),
};

// ── CV Upload & AI Parsing ──
export const cvService = {
  uploadCV: (file) => {
    const formData = new FormData();
    formData.append("cv", file);
    return api.post("/career/upload-cv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getParsedData: () => api.get("/career/cv-parsed"),
  confirmMilestones: (parsedId, milestones) =>
    api.post(`/career/cv-parsed/${parsedId}/confirm`, { milestones }),
};

// ── Career Milestones ──
export const careerService = {
  getMilestones: (profileId) => api.get(`/career/${profileId}/milestones`),
  addMilestone: (data) => api.post("/career/milestones", data),
  updateMilestone: (id, data) => api.put(`/career/milestones/${id}`, data),
  deleteMilestone: (id) => api.delete(`/career/milestones/${id}`),
};

// ── Jobs ──
export const jobService = {
  getJobs: (params) => api.get("/jobs", { params }),
  getJobById: (id) => api.get(`/jobs/${id}`),
  createJob: (data) => api.post("/jobs", data),
  updateJob: (id, data) => api.put(`/jobs/${id}`, data),
  deleteJob: (id) => api.delete(`/jobs/${id}`),
  getMatchedJobs: () => api.get("/jobs/matched"), // AI Smart Matching
};

// ── Messaging ──
export const messageService = {
  getConversations: (params) => api.get("/messages/conversations", { params }),
  // params: { search, program, unread_only }
  getMessages: (conversationId) =>
    api.get(`/messages/${conversationId}`),
  sendMessage: (data) => api.post("/messages", data),
};

// ── Message Requests (for private profiles) ──
export const messageRequestService = {
  getIncoming: () => api.get("/message-requests/incoming"),
  getOutgoing: () => api.get("/message-requests/outgoing"),
  send: (recipientId, message) =>
    api.post("/message-requests", { recipientId, message }),
  accept: (requestId) => api.patch(`/message-requests/${requestId}/accept`),
  decline: (requestId) => api.patch(`/message-requests/${requestId}/decline`),
};

// ── Analytics (Career Advisor/Admin) ──
export const analyticsService = {
  getDashboardStats: () => api.get("/analytics/dashboard"),
  getCareerPredictions: (profileId) =>
    api.get(`/analytics/career-prediction/${profileId}`),
  getCurriculumImpact: (params) =>
    api.get("/analytics/curriculum-impact", { params }),
  getEmploymentTrends: (params) =>
    api.get("/analytics/employment-trends", { params }),
};

// ── Chatbot (Student) ──
export const chatbotService = {
  sendMessage: (message, history) =>
    api.post("/chatbot/message", { message, history }),
};

// ── Feedback ──
export const feedbackService = {
  submit: (data) => api.post("/feedback", data),
  getAll: (params) => api.get("/feedback", { params }),
  updateStatus: (id, data) => api.patch(`/feedback/${id}`, data),
};

export default api;
