const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { sql } = require("@vercel/postgres");

require("dotenv").config();

const app = express();
const rootDir = __dirname;
const preferredDataDir = process.env.DATA_DIR || process.env.RENDER_DISK_PATH || path.join(rootDir, "data");
let dataDir = preferredDataDir;
let dataFile = path.join(dataDir, "store.json");
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "change-this-secret";
const jobSecret = process.env.JOB_SECRET || "change-this-job-secret";
const promoAdminSecret = process.env.PROMO_ADMIN_SECRET || "change-this-promo-secret";
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const allowTestCodes = String(process.env.ALLOW_TEST_CODES || "false") === "true";
const apifreeKey = process.env.APIFREELLM_KEY || process.env.APIFREE_LLM_KEY || "";
const apifreeModel = process.env.APIFREELLM_MODEL || "apifreellm";
const apifreeEndpoint = "https://apifreellm.com/api/v1/chat";
const groqApiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY || "";
const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const groqEndpoint = "https://api.groq.com/openai/v1/chat/completions";
const deepseekKey = process.env.DEEPSEEK_API_KEY || "";
const deepseekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const geminiKey = process.env.GEMINI_API_KEY || "";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
const aiDailyLimitFree = Number(process.env.AI_DAILY_LIMIT_FREE || process.env.AI_DAILY_LIMIT || 30);
const aiDailyLimitPremium = Number(process.env.AI_DAILY_LIMIT_PREMIUM || 200);
const azureOpenAIEndpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const azureOpenAIKey = process.env.AZURE_OPENAI_KEY || "";
const azureOpenAIDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || "";
const azureOpenAIApiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";
const bannerFileName = "DearFutureMe.png";
const bannerFilePath = path.join(rootDir, bannerFileName);
const bannerUrl = `${appBaseUrl}/${encodeURIComponent(bannerFileName)}`;
const bannerCid = "dfm-banner";
const NUM_EXPR_RE = new RegExp("([0-9][0-9+\\-*/().\\s]*)");
const NUM_EXPR_SAFE_RE = new RegExp("^[0-9+\\-*/().]+$");
const SIMPLE_MATH_RE = new RegExp("(-?\\d+)\\s*([+\\-*/])\\s*(-?\\d+)");
if (process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}
const useDatabase = Boolean(process.env.POSTGRES_URL);
const defaultStore = {
  users: [],
  capsules: [],
  reviews: [],
  pendingRegistrations: [],
  pendingPasswordResets: [],
  promoCodes: [],
  adminProfile: {
    firstName: "Admin",
    lastName: "Odyla",
    email: "admin@dearfutureme.com",
    avatar: ""
  },
  adminSettings: {
    siteName: "DearFutureMe",
    supportEmail: "support@dearfutureme.com"
  },
  aiUsage: {
    logs: []
  }
};
let storeReady = false;

app.use(express.json({ limit: "20mb" }));
app.use(
  express.static(rootDir, {
    setHeaders(res, filePath) {
      const lower = filePath.toLowerCase();
      if (lower.endsWith("admin.html")) {
        res.setHeader("Content-Type", "text/html; charset=UTF-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      if (lower.endsWith("admin.css")) {
        res.setHeader("Content-Type", "text/css; charset=UTF-8");
      }
      if (lower.endsWith("admin-main.js")) {
        res.setHeader("Content-Type", "text/javascript; charset=UTF-8");
      }
      if (lower.endsWith("admin.css") || lower.endsWith("admin-main.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }
  })
);

function switchToTempStore(err) {
  if (dataDir.startsWith(os.tmpdir())) {
    throw err;
  }
  const tempDir = path.join(os.tmpdir(), "dearfutureme-data");
  dataDir = tempDir;
  dataFile = path.join(dataDir, "store.json");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

async function ensureStore() {
  if (storeReady) return;
  if (useDatabase) {
    await sql`CREATE TABLE IF NOT EXISTS dfm_store (id int primary key, data jsonb not null)`;
    const existing = await sql`SELECT id FROM dfm_store WHERE id = 1`;
    if (existing.rowCount === 0) {
      await sql`INSERT INTO dfm_store (id, data) VALUES (1, ${defaultStore})`;
    }
    storeReady = true;
    return;
  }
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      switchToTempStore(error);
    }
  }
  if (!fs.existsSync(dataFile)) {
    try {
      fs.writeFileSync(dataFile, JSON.stringify(defaultStore, null, 2), "utf8");
    } catch (error) {
      switchToTempStore(error);
    }
  }
  storeReady = true;
}

async function readStore() {
  await ensureStore();
  if (useDatabase) {
    const result = await sql`SELECT data FROM dfm_store WHERE id = 1`;
    const store = result.rows[0]?.data || { ...defaultStore };
    if (!Array.isArray(store.users)) store.users = [];
    if (!Array.isArray(store.capsules)) store.capsules = [];
    if (!Array.isArray(store.reviews)) store.reviews = [];
    if (!Array.isArray(store.pendingRegistrations)) store.pendingRegistrations = [];
    if (!Array.isArray(store.pendingPasswordResets)) store.pendingPasswordResets = [];
    if (!Array.isArray(store.promoCodes)) store.promoCodes = [];
    if (!store.adminProfile || typeof store.adminProfile !== "object") {
      store.adminProfile = { ...defaultStore.adminProfile };
    } else {
      store.adminProfile = {
        ...defaultStore.adminProfile,
        ...store.adminProfile
      };
    }
    if (!store.adminSettings || typeof store.adminSettings !== "object") {
      store.adminSettings = { ...defaultStore.adminSettings };
    } else {
      store.adminSettings = {
        ...defaultStore.adminSettings,
        ...store.adminSettings
      };
    }
    return store;
  }
  let raw = "";
  try {
    raw = fs.readFileSync(dataFile, "utf8").replace(/^\uFEFF/, "");
  } catch (error) {
    switchToTempStore(error);
    raw = fs.readFileSync(dataFile, "utf8").replace(/^\uFEFF/, "");
  }
  const store = JSON.parse(raw);
  if (!Array.isArray(store.users)) store.users = [];
  if (!Array.isArray(store.capsules)) store.capsules = [];
  if (!Array.isArray(store.reviews)) store.reviews = [];
  if (!Array.isArray(store.pendingRegistrations)) store.pendingRegistrations = [];
  if (!Array.isArray(store.pendingPasswordResets)) store.pendingPasswordResets = [];
  if (!Array.isArray(store.promoCodes)) store.promoCodes = [];
  if (!store.adminProfile || typeof store.adminProfile !== "object") {
    store.adminProfile = { ...defaultStore.adminProfile };
  } else {
    store.adminProfile = {
      ...defaultStore.adminProfile,
      ...store.adminProfile
    };
  }
  if (!store.adminSettings || typeof store.adminSettings !== "object") {
    store.adminSettings = { ...defaultStore.adminSettings };
  } else {
    store.adminSettings = {
      ...defaultStore.adminSettings,
      ...store.adminSettings
    };
  }
  return store;
}

async function writeStore(store) {
  await ensureStore();
  if (useDatabase) {
    await sql`UPDATE dfm_store SET data = ${store} WHERE id = 1`;
    return;
  }
  try {
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), "utf8");
  } catch (error) {
    switchToTempStore(error);
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), "utf8");
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidUserName(name) {
  return /^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(String(name || ""));
}

function getAdminEmails() {
  return Array.from(
    new Set(
      [
        process.env.SMTP_USER,
        "dearfuturemeportal@gmail.com",
        ...(String(process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean))
      ]
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    )
  );
}

function isAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return getAdminEmails().includes(normalized);
}

function isPlaceholderCity(city) {
  const value = String(city || "").trim().toLowerCase();
  return !value || [
    "your city",
    "ваш город",
    "deine stadt",
    "tu ciudad",
    "votre ville"
  ].includes(value);
}

function publicUser(user) {
  const premiumUntil = user.premiumUntil || null;
  const isPremium = premiumUntil ? new Date(premiumUntil).getTime() > Date.now() : false;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    plan: isPremium ? "premium" : "free",
    premiumUntil,
    premiumSource: user.premiumSource || null,
    isAdmin: isAdminEmail(user.email)
  };
}

function hasActivePremium(user) {
  return !!user && !!user.premiumUntil && new Date(user.premiumUntil).getTime() > Date.now();
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function analyzeEmotion(text) {
  const s = String(text || "").toLowerCase();
  const set = [
    { id: "love", label: "Love", color: "#d96c8f", k: ["love", "любов", "сердц", "люблю", "обнима", "семь"] },
    { id: "hope", label: "Hope", color: "#c4933f", k: ["hope", "надеж", "верю", "мечта", "мечт"] },
    { id: "fear", label: "Fear", color: "#7f7f9a", k: ["fear", "страх", "бою", "паник", "ужас"] },
    { id: "joy", label: "Joy", color: "#e8c97a", k: ["joy", "счаст", "радост", "улыб"] },
    { id: "dream", label: "Dreams", color: "#6aa57a", k: ["dream", "goal", "цель", "достиг", "план"] }
  ];
  for (const d of set) {
    if (d.k.some((k) => s.includes(k))) return d;
  }
  return { id: "calm", label: "Calm", color: "#8a7f6f" };
}

const EMOJI_SET = new Set([
  "✨",
  "❤️",
  "😊",
  "😌",
  "🌿",
  "😨",
  "🚀",
  "🔥",
  "🌙",
  "🌊"
]);

function isValidEmoji(value) {
  if (!value) return true;
  return EMOJI_SET.has(value);
}

function generateScene(text) {
  const year = new Date().getFullYear() + 10;
  const places = ["by the sea", "in a quiet city", "in the mountains", "in a warm room"];
  const idx = Math.abs(String(text || "").length) % places.length;
  return `${year} year. You are ${places[idx]} and reading your letter.`;
}

function buildPromoCode(duration) {
  const prefix = duration === "year" ? "DFM-Y" : "DFM-M";
  return `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function promoDurationMonths(duration) {
  return duration === "year" ? 12 : 1;
}

function promoDurationLabel(duration) {
  return duration === "year" ? "1 год" : "1 месяц";
}

function buildReviewStats(reviews) {
  const items = (Array.isArray(reviews) ? reviews : []).filter((r) => !r.deletedAt);
  const total = items.length;
  const ratingSum = items.reduce((sum, r) => sum + Number(r.rating || 0), 0);
  const avg = total ? ratingSum / total : 0;
  const pending = items.filter((r) => r.status === "pending").length;
  const complaints = items.filter((r) => r.status === "complaint").length;
  const published = items.filter((r) => !r.status || r.status === "published").length;
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  items.forEach((r) => {
    const v = Math.max(1, Math.min(5, Math.round(Number(r.rating || 0))));
    if (breakdown[v] !== undefined) breakdown[v] += 1;
  });
  return { total, avg, pending, complaints, published, breakdown };
}

function adminPromoRequired(req, res, next) {
  if ((req.headers["x-admin-secret"] || "") !== promoAdminSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function adminRequired(req, res, next) {
  if (process.env.NODE_ENV !== "production" && req.path.startsWith("/api/admin/")) {
    return next();
  }
  if (!req.user || !isAdminEmail(req.user.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    jwtSecret,
    { expiresIn: "30d" }
  );
}

async function authRequired(req, res, next) {
  if (process.env.NODE_ENV !== "production" && req.path.startsWith("/api/admin/")) {
    return next();
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const store = await readStore();
    const user = store.users.find((entry) => entry.id === payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function getAiUsage(store) {
  if (!store.aiUsage || typeof store.aiUsage !== "object") {
    store.aiUsage = { logs: [] };
  }
  if (!Array.isArray(store.aiUsage.logs)) {
    store.aiUsage.logs = [];
  }
  return store.aiUsage;
}

function recordAiUsage(store, entry) {
  const usage = getAiUsage(store);
  usage.logs.push(entry);
  const maxLogs = 2000;
  if (usage.logs.length > maxLogs) {
    usage.logs = usage.logs.slice(-maxLogs);
  }
}

function getDailyAiCount(logs, key, dateKey) {
  return logs.filter((l) => l && l.day === dateKey && l.userKey === key).length;
}

function getDayKey(ts) {
  const d = new Date(ts || Date.now());
  return d.toISOString().slice(0, 10);
}

function getUserCapsuleStats(store, userId) {
  const now = Date.now();
  const items = (Array.isArray(store.capsules) ? store.capsules : []).filter((c) => c && c.userId === userId);
  const parsed = items.map((c) => ({
    id: c.id,
    openDate: new Date(c.openDate || 0).getTime(),
    createdAt: new Date(c.createdAt || 0).getTime()
  })).filter((c) => Number.isFinite(c.openDate));
  const total = parsed.length;
  const opened = parsed.filter((c) => c.openDate <= now).length;
  const scheduled = parsed.filter((c) => c.openDate > now).length;
  const next = parsed.filter((c) => c.openDate > now).sort((a,b)=>a.openDate-b.openDate)[0];
  const upcoming = parsed.filter((c) => c.openDate > now).sort((a,b)=>a.openDate-b.openDate).slice(0,3);
  return {
    total,
    opened,
    scheduled,
    nextOpen: next ? next.openDate : null,
    upcoming: upcoming.map((c)=>c.openDate)
  };
}

function formatDateRu(ts){
  try { return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch(e){ return ''; }
}

function keeperUserReply(message, user) {
  const text = String(message || "").toLowerCase();
  if (!user || !user.userId) {
    return "Чтобы я видел твои капсулы, нужно войти в аккаунт.";
  }
  const stats = getUserCapsuleStats(user.store, user.userId);
  const kw = {
    howMany: "скольк",
    capsules: "капсул",
    when: "когда",
    open: "откр",
    nearest: "ближайш",
    next: "следующ",
    list: "список",
    opened: "открыт",
    planned: "заплан",
    future: "будущ"
  };
  const has = (k) => text.includes(k);
  if (has(kw.howMany) && has(kw.capsules)) {
    return `У тебя ${stats.total} капсул. Открытых: ${stats.opened}, запланировано: ${stats.scheduled}.`;
  }
  if ((has(kw.when) && has(kw.open)) || has(kw.nearest) || has(kw.next)) {
    if (!stats.nextOpen) return "Пока нет запланированных открытий. Можешь создать новую капсулу.";
    const d = formatDateRu(stats.nextOpen);
    return `Ближайшая капсула откроется ${d}.`;
  }
  if (has(kw.list) && has(kw.open)) {
    if (!stats.upcoming.length) return "Пока нет запланированных открытий. Можешь создать новую капсулу.";
    const list = stats.upcoming.map((t, i) => `${i+1}) ${formatDateRu(t)}`).join(" ");
    return `Ближайшие открытия: ${list}.`;
  }
  if (has(kw.opened)) {
    return `Уже открыто: ${stats.opened}. В ожидании: ${stats.scheduled}.`;
  }
  if (has(kw.planned) || has(kw.future)) {
    return `Запланировано к открытию: ${stats.scheduled}.`;
  }
  return null;
}


function serializeCapsule(capsule) {
  return {
    id: capsule.id,
    userId: capsule.userId,
    name: capsule.name,
    email: capsule.email,
    message: capsule.message,
    openDate: capsule.openDate,
    visibility: capsule.visibility,
    prediction: capsule.prediction,
    style: capsule.style || "classic",
    photoUrl: capsule.photoUrl || null,
    videoUrl: capsule.videoUrl || null,
    audioUrl: capsule.audioUrl || null,
    hunt: !!capsule.hunt,
    secret: !!capsule.secretHash,
    emoji: capsule.emoji || null,
    emotion: capsule.emotion || null,
    futureScene: capsule.futureScene || null,
    createdAt: capsule.createdAt,
    city: capsule.city,
    lat: capsule.lat,
    lng: capsule.lng,
    deliveredAt: capsule.deliveredAt || null
  };
}

function serializePublicCapsule(capsule) {
  return {
    id: capsule.id,
    userId: capsule.userId,
    name: capsule.name,
    message: capsule.secretHash ? "" : capsule.message,
    openDate: capsule.openDate,
    prediction: capsule.prediction,
    style: capsule.style || "classic",
    photoUrl: capsule.photoUrl || null,
    videoUrl: capsule.videoUrl || null,
    audioUrl: capsule.audioUrl || null,
    hunt: !!capsule.hunt,
    secret: !!capsule.secretHash,
    emoji: capsule.emoji || null,
    emotion: capsule.emotion || null,
    futureScene: capsule.futureScene || null,
    createdAt: capsule.createdAt,
    city: capsule.city,
    lat: capsule.lat,
    lng: capsule.lng
  };
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidPhotoUrl(value) {
  if (!value) return true;
  if (value.startsWith("data:image/")) {
    return value.length <= 800000;
  }
  return isHttpUrl(value);
}

function isValidVideoUrl(value) {
  if (!value) return true;
  if (value.startsWith("data:video/")) {
    return value.length <= 12000000;
  }
  return isHttpUrl(value);
}

function isValidAudioUrl(value) {
  if (!value) return true;
  if (value.startsWith("data:audio/")) {
    return value.length <= 6000000;
  }
  return isHttpUrl(value);
}

function getStats(store) {
  const delivered = store.capsules.filter((capsule) => capsule.deliveredAt).length;
  return {
    sealed: store.capsules.length,
    countries: 0,
    delivered,
    users: store.users.length
  };
}

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function cleanupPendingRegistrations(store) {
  const now = Date.now();
  store.pendingRegistrations = store.pendingRegistrations.filter((entry) => {
    return new Date(entry.expiresAt).getTime() > now;
  });
}

function cleanupPendingPasswordResets(store) {
  const now = Date.now();
  store.pendingPasswordResets = store.pendingPasswordResets.filter((entry) => {
    return new Date(entry.expiresAt).getTime() > now;
  });
}

function buildVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

async function sendVerificationCodeEmail({ email, name, code }) {
  const transporter = getTransporter();
  const bannerAttachment = getEmailBannerAttachment();
  if (!transporter) {
    return { delivered: false, reason: "smtp_not_configured" };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Welcome to DearFutureMe - confirm your account",
      attachments: bannerAttachment ? [bannerAttachment] : [],
      text: [
        `Hello, ${name}.`,
        "",
        "Welcome to DearFutureMe.",
        "You are almost done creating your account.",
        "",
        "Use this verification code to confirm your registration:",
        "",
        code,
        "",
        "The code expires in 10 minutes.",
        "",
        "Write to your future self. Seal your capsule. Let time deliver it."
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#201810">
          ${getEmailBannerHtml()}
          <h2 style="margin:0 0 16px">Welcome to DearFutureMe</h2>
          <p>Hello, <strong>${escapeHtml(name)}</strong>.</p>
          <p>Thank you for creating an account on <strong>DearFutureMe</strong>.</p>
          <p>Use this verification code to confirm your registration:</p>
          <div style="margin:24px 0;padding:18px 20px;background:#f7f1e7;border:1px solid #e2c488;font-size:32px;letter-spacing:10px;text-align:center;font-weight:bold;color:#8d6422;">
            ${escapeHtml(code)}
          </div>
          <p>The code expires in 10 minutes.</p>
          <p style="margin-top:20px;color:#5a4a36">Write to your future self. Seal your capsule. Let time deliver it.</p>
        </div>
      `
    });

    return { delivered: true, reason: null };
  } catch (error) {
    return { delivered: false, reason: `smtp_failed:${error.message}` };
  }
}

async function sendPasswordResetEmail({ email, name, code }) {
  const transporter = getTransporter();
  const bannerAttachment = getEmailBannerAttachment();
  if (!transporter) {
    return { delivered: false, reason: "smtp_not_configured" };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "DearFutureMe - password reset code",
      attachments: bannerAttachment ? [bannerAttachment] : [],
      text: [
        `Hello, ${name || "friend"}.`,
        "",
        "We received a request to reset your password.",
        "Use this 6-digit code to set a new password:",
        "",
        code,
        "",
        "If you did not request this, you can ignore this email.",
        "",
        "DearFutureMe"
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#201810">
          ${getEmailBannerHtml()}
          <h2 style="margin:0 0 16px">Reset your password</h2>
          <p>Hello, <strong>${escapeHtml(name || "friend")}</strong>.</p>
          <p>We received a request to reset your password.</p>
          <p>Use this 6-digit code to set a new password:</p>
          <div style="margin:24px 0;padding:18px 20px;background:#f7f1e7;border:1px solid #e2c488;font-size:32px;letter-spacing:10px;text-align:center;font-weight:bold;color:#8d6422;">
            ${escapeHtml(code)}
          </div>
          <p>If you did not request this, you can ignore this email.</p>
          <p style="margin-top:20px;color:#5a4a36">DearFutureMe</p>
        </div>
      `
    });

    return { delivered: true };
  } catch (error) {
    return { delivered: false, reason: error.message };
  }
}

async function sendWelcomeEmail({ email, name }) {
  const transporter = getTransporter();
  const bannerAttachment = getEmailBannerAttachment();
  if (!transporter) {
    return { delivered: false, reason: "smtp_not_configured" };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Welcome - your DearFutureMe account is ready",
      attachments: bannerAttachment ? [bannerAttachment] : [],
      text: [
        `Hello, ${name}.`,
        "",
        "Your DearFutureMe account has been successfully created.",
        "",
        "Now you can:",
        "- write your first capsule",
        "- save private or public messages",
        "- open your profile and track your capsules",
        "",
        `Open the site: ${appBaseUrl}`
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#201810">
          ${getEmailBannerHtml()}
          <h2 style="margin:0 0 16px">Your DearFutureMe account is ready</h2>
          <p>Hello, <strong>${escapeHtml(name)}</strong>.</p>
          <p>You have successfully registered on <strong>DearFutureMe</strong>.</p>
          <p>Now you can write your first capsule, save public or private messages, and manage everything from your profile.</p>
          <p style="margin-top:24px"><a href="${escapeAttribute(appBaseUrl)}" style="display:inline-block;padding:12px 18px;background:#c4933f;color:#1a1410;text-decoration:none">Open DearFutureMe</a></p>
        </div>
      `
    });

    return { delivered: true, reason: null };
  } catch (error) {
    return { delivered: false, reason: `smtp_failed:${error.message}` };
  }
}

async function deliverDueCapsules() {
  const transporter = getTransporter();
  const bannerAttachment = getEmailBannerAttachment();
  if (!transporter) {
    return { sent: 0, pending: 0, skipped: "smtp_not_configured" };
  }

  const now = Date.now();
  const store = await readStore();
  const due = store.capsules.filter((capsule) => {
    if (capsule.deliveredAt) {
      return false;
    }
    return new Date(capsule.openDate).getTime() <= now;
  });

  let sent = 0;

  for (const capsule of due) {
    if (!isCapsuleAllowed({ message: capsule.message, prediction: capsule.prediction })) {
      continue;
    }

    const openDate = new Date(capsule.openDate).toLocaleString("ru-RU");
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: capsule.email,
      subject: "Your DearFutureMe capsule is ready",
      attachments: bannerAttachment ? [bannerAttachment] : [],
      text: [
        `Hello, ${capsule.name}.`,
        "",
        `Your capsule opened on ${openDate}.`,
        "",
        capsule.message,
        "",
        capsule.prediction ? `AI reflection: ${capsule.prediction}` : "",
        "",
        `Open the site: ${appBaseUrl}`
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#201810">
          ${getEmailBannerHtml()}
          <h2 style="margin:0 0 16px">Your DearFutureMe capsule is ready</h2>
          <p>Hello, <strong>${escapeHtml(capsule.name)}</strong>.</p>
          <p>Your capsule opened on <strong>${escapeHtml(openDate)}</strong>.</p>
          <blockquote style="margin:24px 0;padding:16px 18px;border-left:4px solid #c4933f;background:#f7f1e7">
            ${escapeHtml(capsule.message).replace(/\n/g, "<br>")}
          </blockquote>
          ${
            capsule.prediction
              ? `<p><strong>AI reflection:</strong> ${escapeHtml(capsule.prediction)}</p>`
              : ""
          }
          <p><a href="${escapeAttribute(appBaseUrl)}">Open DearFutureMe</a></p>
        </div>
      `
    });

    capsule.deliveredAt = new Date().toISOString();
    sent += 1;
  }

  if (sent > 0) {
    await writeStore(store);
  }

  return { sent, pending: due.length - sent, skipped: null };
}

function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatDaysRu(days) {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return `${days} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${days} дня`;
  return `${days} дней`;
}

function getDaysLeft(openDate) {
  const diff = new Date(openDate).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.ceil(diff / 86400000));
}

async function sendDailyReminders() {
  const transporter = getTransporter();
  const bannerAttachment = getEmailBannerAttachment();
  if (!transporter) {
    return { sent: 0, pending: 0, skipped: "smtp_not_configured" };
  }

  const now = Date.now();
  const todayKey = getUtcDateKey();
  const store = await readStore();
  const pending = store.capsules.filter((capsule) => {
    if (capsule.deliveredAt) return false;
    return new Date(capsule.openDate).getTime() > now;
  });

  let sent = 0;
  for (const capsule of pending) {
    if (capsule.reminderLastSent === todayKey) continue;
    const daysLeft = getDaysLeft(capsule.openDate);
    if (!daysLeft || daysLeft <= 0) continue;

    const openDate = new Date(capsule.openDate).toLocaleDateString("ru-RU");
    const daysLabel = formatDaysRu(daysLeft);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: capsule.email,
      attachments: bannerAttachment ? [bannerAttachment] : [],
      subject: `Напоминание DearFutureMe — осталось ${daysLabel}`,
      text: [
        `Здравствуйте, ${capsule.name}.`,
        "",
        `До открытия вашей капсулы осталось ${daysLabel}.`,
        `Дата открытия: ${openDate}.`,
        "",
        `Открыть сайт: ${appBaseUrl}`
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#201810">
          ${getEmailBannerHtml()}
          <h2 style="margin:0 0 16px">Напоминание DearFutureMe</h2>
          <p>Здравствуйте, <strong>${escapeHtml(capsule.name)}</strong>.</p>
          <p>До открытия вашей капсулы осталось <strong>${escapeHtml(daysLabel)}</strong>.</p>
          <p>Дата открытия: <strong>${escapeHtml(openDate)}</strong>.</p>
          <p style="margin-top:24px"><a href="${escapeAttribute(appBaseUrl)}">Открыть DearFutureMe</a></p>
        </div>
      `
    });

    capsule.reminderLastSent = todayKey;
    sent += 1;
  }

  if (sent > 0) {
    await writeStore(store);
  }

  return { sent, pending: pending.length - sent, skipped: null };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEmailBannerAttachment() {
  if (!fs.existsSync(bannerFilePath)) return null;
  return {
    filename: bannerFileName,
    path: bannerFilePath,
    cid: bannerCid,
    contentType: "image/png",
    contentDisposition: "inline"
  };
}

function getEmailBannerHtml() {
  if (fs.existsSync(bannerFilePath)) {
    return `
      <div style="margin:0 0 18px;text-align:center">
        <img src="cid:${bannerCid}" alt="DearFutureMe" style="max-width:100%;height:auto;border-radius:12px;display:block;margin:0 auto">
      </div>
    `;
  }
  return `
    <div style="margin:0 0 18px;text-align:center">
      <img src="${escapeAttribute(bannerUrl)}" alt="DearFutureMe" style="max-width:100%;height:auto;border-radius:12px;display:block;margin:0 auto">
    </div>
  `;
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function callGeminiGenerateContent({ message, messages, systemInstruction }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const models = Array.from(
    new Set([geminiModel, "gemini-2.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"])
  ).filter(Boolean);
  let lastError = null;
  try {
    const parts = [];
    if (Array.isArray(messages) && messages.length) {
      messages.forEach((m) => {
        if (m && typeof m.content === "string") {
          parts.push({ text: m.content });
        }
      });
    } else if (message) {
      parts.push({ text: String(message).slice(0, 4000) });
    }
    const payload = {
      contents: [{ role: "user", parts: parts.length ? parts : [{ text: "" }] }],
      generationConfig: { temperature: 0.2 }
    };
    if (systemInstruction) {
      payload.system_instruction = { parts: [{ text: String(systemInstruction).slice(0, 2000) }] };
    }

    for (const model of models) {
      const url = `${geminiBaseUrl}/models/${encodeURIComponent(model)}:generateContent`;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const reason = data?.error?.message || data?.error || response.statusText || "gemini_failed";
          console.error("Gemini API error:", response.status, reason, "model:", model);
          if (response.status === 404) {
            lastError = new Error(reason);
            continue;
          }
          throw new Error(reason);
        }
        const reply =
          data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
        const trimmed = String(reply || "").trim();
        if (trimmed) {
          return trimmed;
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("gemini_failed");
  } catch (err) {
    if (err && err.name === "AbortError") {
      console.error("Gemini API timeout");
    } else {
      console.error("Gemini API failure:", err && err.message ? err.message : err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function callDeepSeekChat({ message, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const base = deepseekBaseUrl.replace(/\/+$/, "");
    const url = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
    const payload = { model: deepseekModel };
    if (Array.isArray(messages) && messages.length) {
      payload.messages = messages;
    } else {
      payload.messages = [{ role: "user", content: String(message || "").slice(0, 4000) }];
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = data?.error?.message || data?.error || response.statusText || "deepseek_failed";
      console.error("DeepSeek API error:", response.status, reason);
      throw new Error(reason);
    }
    const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    return String(reply || "").trim();
  } catch (err) {
    if (err && err.name === "AbortError") {
      console.error("DeepSeek API timeout");
    } else {
      console.error("DeepSeek API failure:", err && err.message ? err.message : err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function callApiFreeLLM({ message, messages, systemInstruction }) {
  if (geminiKey) {
    return callGeminiGenerateContent({ message, messages, systemInstruction });
  }
  if (deepseekKey) {
    return callDeepSeekChat({ message, messages });
  }
  if (azureOpenAIEndpoint && azureOpenAIKey && azureOpenAIDeployment) {
    return callAzureOpenAI({ message, messages });
  }
  const endpoint = apifreeEndpoint;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "DearFutureMe/1.0 (support@dearfutureme.local)"
    };
    if (apifreeKey) {
      headers.Authorization = `Bearer ${apifreeKey}`;
    }
    const payload = { model: apifreeModel };
    if (Array.isArray(messages) && messages.length) {
      payload.messages = messages;
    }
    if (message) {
      payload.message = message;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === "error") {
      const reason = data?.error || response.statusText || "api_failed";
      throw new Error(reason);
    }
    const reply =
      data.reply ||
      data.response ||
      data.output ||
      data.message ||
      data.result ||
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      "";
    if (Array.isArray(reply)) {
      return reply.join(" ").trim();
    }
    return String(reply || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

// Primary Keeper AI routes (must be defined before any legacy handlers below)
app.post("/api/keeper/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message required" });
  const userEmail = String(req.body?.userEmail || "").trim().toLowerCase();
  const userKey = userEmail || (req.headers["x-user-key"] ? String(req.headers["x-user-key"]) : "guest");
  const provider =
    (geminiKey && "gemini") ||
    (deepseekKey && "deepseek") ||
    (azureOpenAIKey && azureOpenAIDeployment && "azure") ||
    (groqApiKey && "groq") ||
    (apifreeKey && "apifree") ||
    "local";
  const model =
    (provider == "gemini" && geminiModel) ||
    (provider == "deepseek" && deepseekModel) ||
    (provider == "azure" && azureOpenAIDeployment) ||
    (provider == "groq" && groqModel) ||
    (provider == "apifree" && apifreeModel) ||
    "local";
  const start = Date.now();
  const store = await readStore();
  const usage = getAiUsage(store);
  const dayKey = getDayKey(start);
  const user = userEmail ? (Array.isArray(store.users) ? store.users : []).find((u)=>u.email===userEmail) : null;
  const userCtx = { store, userId: user && user.id };
  const personal = keeperUserReply(message, userCtx);
  if (personal) {
    recordAiUsage(store, {
      ts: new Date().toISOString(),
      day: dayKey,
      userKey,
      email: userEmail,
      type: "keeper_chat",
      ok: true,
      latencyMs: Date.now() - start,
      provider,
      model,
      textLen: String(personal||"").length
    });
    await writeStore(store);
    return res.json({ reply: personal });
  }
  const isPremiumUser = Boolean(user && hasActivePremium(user));
  const dayLimit = isPremiumUser ? aiDailyLimitPremium : aiDailyLimitFree;
  const dayCount = getDailyAiCount(usage.logs, userKey, dayKey);
  if (Number.isFinite(dayLimit) && dayLimit > 0 && dayCount >= dayLimit) {
    recordAiUsage(store, {
      ts: new Date().toISOString(),
      day: dayKey,
      userKey,
      email: userEmail,
      type: "keeper_chat",
      ok: false,
      error: "limit",
      provider,
      model,
      limit: dayLimit
    });
    await writeStore(store);
    return res.status(429).json({ error: "Daily AI limit reached" });
  }
  try {
    const systemInstruction = [
      "You are the Keeper of DearFutureMe time capsules.",
      "Reply in Russian. Tone: warm, poetic, calm, atmospheric, but clear.",
      "If the question is factual or about the site, answer directly and briefly.",
      "Never reveal the content of a user's letters or private data."
    ].join("\n");
    const reply = await callApiFreeLLM({ message, systemInstruction });
    if (reply) {
      recordAiUsage(store, {
        ts: new Date().toISOString(),
        day: dayKey,
        userKey,
        email: userEmail,
        type: "keeper_chat",
        ok: true,
        latencyMs: Date.now() - start,
        provider,
        model,
        textLen: String(reply || "").length
      });
      await writeStore(store);
      return res.json({ reply });
    }
    recordAiUsage(store, {
      ts: new Date().toISOString(),
      day: dayKey,
      userKey,
      email: userEmail,
      type: "keeper_chat",
      ok: false,
      error: "empty",
      latencyMs: Date.now() - start,
      provider,
      model
    });
    await writeStore(store);
    return res.json({ reply: "Try asking in another way." });
  } catch (error) {
    recordAiUsage(store, {
      ts: new Date().toISOString(),
      day: dayKey,
      userKey,
      email: userEmail,
      type: "keeper_chat",
      ok: false,
      error: error && error.message ? error.message : String(error || ""),
      latencyMs: Date.now() - start,
      provider,
      model
    });
    await writeStore(store);
    return res.json({ reply: "Try asking in another way." });
  }
});

app.post("/api/keeper/photo", async (req, res) => {
  const caption = String(req.body?.caption || req.body?.prompt || "").trim();
  const userEmail = String(req.body?.userEmail || "").trim().toLowerCase();
  const userKey = userEmail || (req.headers['x-user-key'] ? String(req.headers['x-user-key']) : 'guest');
  const provider =
    (geminiKey && "gemini") ||
    (deepseekKey && "deepseek") ||
    (azureOpenAIKey && azureOpenAIDeployment && "azure") ||
    (groqApiKey && "groq") ||
    (apifreeKey && "apifree") ||
    "local";
  const model =
    (provider === "gemini" && geminiModel) ||
    (provider === "deepseek" && deepseekModel) ||
    (provider === "azure" && azureOpenAIDeployment) ||
    (provider === "groq" && groqModel) ||
    (provider === "apifree" && apifreeModel) ||
    "local";
  const start = Date.now();
  const store = await readStore();
  const usage = getAiUsage(store);
  const dayKey = getDayKey(start);
  const isPremiumUser = Boolean(userEmail && (Array.isArray(store.users)?store.users:[]).find((u)=>u.email===userEmail) && hasActivePremium((Array.isArray(store.users)?store.users:[]).find((u)=>u.email===userEmail)));
  const dayLimit = isPremiumUser ? aiDailyLimitPremium : aiDailyLimitFree;
  const dayCount = getDailyAiCount(usage.logs, userKey, dayKey);
  if (Number.isFinite(dayLimit) && dayLimit > 0 && dayCount >= dayLimit) {
    recordAiUsage(store, {
      ts: new Date().toISOString(),
      day: dayKey,
      userKey,
      email: userEmail,
      type: 'keeper_photo',
      ok: false,
      error: 'limit',
      provider,
      model
    });
    await writeStore(store);
    return res.status(429).json({ error: 'Daily AI limit reached' });
  }
  try {
    const reply = await callApiFreeLLM({
      messages: [
        {
          role: "system",
          content: "You are the Keeper of time capsules. Describe the photo poetically in 1-2 sentences, in Russian."
        },
        { role: "user", content: caption || "Опиши фото." }
      ]
    });
    recordAiUsage(store, {
      ts: new Date().toISOString(),
      day: dayKey,
      userKey,
      email: userEmail,
      type: 'keeper_photo',
      ok: true,
      latencyMs: Date.now() - start,
      provider,
      model,
      textLen: String(reply||'').length
    });
    await writeStore(store);
    return res.json({ reply: normalizeKeeperReply ? (normalizeKeeperReply(caption, reply) || reply) : reply });
  } catch (error) {
    return res.json({ reply: "Этот образ останется с тобой — как светлый след в капсуле времени." });
  }
});

app.get("/api/keeper/provider", (_req, res) => {
  const provider =
    (geminiKey && "gemini") ||
    (deepseekKey && "deepseek") ||
    (azureOpenAIKey && azureOpenAIDeployment && "azure") ||
    (groqApiKey && "groq") ||
    (apifreeKey && "apifree") ||
    "local";
  const model =
    (provider === "gemini" && geminiModel) ||
    (provider === "deepseek" && deepseekModel) ||
    (provider === "azure" && azureOpenAIDeployment) ||
    (provider === "groq" && groqModel) ||
    (provider === "apifree" && apifreeModel) ||
    "local";
  res.json({ provider, model });
});

async function callAzureOpenAI({ message, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const endpoint = azureOpenAIEndpoint.replace(/\/+$/, "");
    const url = `${endpoint}/openai/deployments/${encodeURIComponent(azureOpenAIDeployment)}/chat/completions?api-version=${encodeURIComponent(azureOpenAIApiVersion)}`;
    const payload = {
      messages: Array.isArray(messages) && messages.length
        ? messages
        : [{ role: "user", content: String(message || "").slice(0, 4000) }]
    };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": azureOpenAIKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = data?.error?.message || response.statusText || "azure_openai_failed";
      throw new Error(reason);
    }
    const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    return String(reply || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

function hasCyrillic(text) {
  return /[А-Яа-яЁё]/.test(text || "");
}

function looksMojibake(text) {
  return /Ã|Â|Ð|Ñ|�/.test(text || "");
}

function normalizeKeeperReply(message, reply) {
  if (!reply) return null;
  const cleaned = String(reply).trim();
  if (!cleaned) return null;
  if (looksMojibake(cleaned)) return null;
  if (!hasCyrillic(cleaned)) return null;
  return cleaned;
}

function craftKeeperReply(message) {
  const text = String(message || "").trim();
  if (!text) return pickKeeperFallback();
  const short = text.length > 180 ? `${text.slice(0, 180)}…` : text;
  return `Ты спрашиваешь: «${short}». Ответ приходит тихо — в том, что ты уже делаешь сегодня.`;
}

function pickKeeperFallback() {
  const replies = [
    "Время — не прямая. Это спираль, где каждый вопрос возвращает тебя к себе.",
    "Будущее уже написано твоими шагами. Сделай следующий тихо и честно.",
    "Каждая секунда — письмо, которое ты отправляешь самому себе.",
    "Ответ живёт внутри вопроса. Я лишь помогаю тебе его услышать.",
    "Запечатай момент — и он станет якорем для будущего."
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function tryLocalKeeperAnswer(message) {
  const text = String(message || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (/кто\s+создал|кто\s+тебя\s+создал|кто\s+твой\s+создател/.test(lower)) {
    return "Меня создали люди и команда Dear FutureMe, чтобы хранить ваши послания сквозь время.";
  }
  if (/кто\s+ты|как\s+тебя\s+зовут|ты\s+кто/.test(lower)) {
    return "Я — Хранитель капсул времени. Я помогаю твоим словам дойти до будущего.";
  }
  if (/привет|здравствуй|здравствуйте|хай|hi|hello/.test(lower)) {
    return "Привет. Я здесь, чтобы помочь тебе связаться с будущим.";
  }

  const mathMatch = null;
  if (mathMatch) {
    const expr = mathMatch[1].replace(/\s+/g, "");
    if (NUM_EXPR_SAFE_RE.test(expr) && expr.length <= 40) {
      try {
        const result = Function(`"use strict";return (${expr});`)();
        if (Number.isFinite(result)) {
          return `Ответ: ${result}`;
        }
      } catch (_) {
        // ignore eval errors
      }
    }
  }

  return null;
}

const ABUSE_PATTERNS = [
  /\b(kill|murder|shoot|stab|bomb|explode|terror|hostage|massacre|attack|assassinat)\b/i,
  /\b(threat|blackmail|extort|ransom)\b/i,
  /\b(suicide bombing|school shooting|pipe bomb)\b/i,
  /(убью|убить|взорв|бомб|теракт|заложник|расстрел|зареж|шантаж|вымогат|угроз)/i,
  /(взорвать|нападу|сожгу|убьем|убью вас)/i,
  /(мчс|сбу|полици|прокуратур|военком|посольств|правительств|госорган)/i
];

function findAbuseMatch(text) {
  const value = String(text || "");
  return ABUSE_PATTERNS.find((pattern) => pattern.test(value)) || null;
}

function isCapsuleAllowed({ message, prediction }) {
  return !findAbuseMatch(message) && !findAbuseMatch(prediction);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/stats", async (_req, res) => {
  const store = await readStore();
  res.json(getStats(store));
});

// Keeper AI (local-only override, Microsoft-style)
const keeperLocalOnlyMode = !(groqApiKey || deepseekKey || geminiKey);
const KEEPER_FALLBACKS_LOCAL = [
  "Я Microsoft AI (локальный режим). Задайте вопрос о капсулах, письмах или настройках.",
  "Могу помочь с письмами, сроками открытия и правилами капсул. Что нужно?",
  "Если вопрос про сайт: регистрация, капсулы, премиум, карта — скажите.",
  "Готов объяснить, как работают капсулы и напоминания.",
  "Опишите проблему — отвечу кратко и по делу."
];
const KEEPER_QUOTES_LOCAL = [
  "Я Microsoft AI (локальный режим). Чем помочь?",
  "Сформулируйте вопрос — отвечу напрямую.",
  "Если нужен расчет или проверка, напишите запрос.",
  "Могу помочь с письмом, датой открытия или настройками."
];
const keeperHasCyrillicLocal = (value) => /[А-Яа-яЁё]/.test(String(value || ""));
const pickKeeperFallbackLocal = () =>
  KEEPER_FALLBACKS_LOCAL[Math.floor(Math.random() * KEEPER_FALLBACKS_LOCAL.length)];
const pickKeeperQuoteLocal = () =>
  KEEPER_QUOTES_LOCAL[Math.floor(Math.random() * KEEPER_QUOTES_LOCAL.length)];

function craftKeeperReplyLocal(message) {
  const text = String(message || "").trim();
  if (!text) return pickKeeperFallbackLocal();
  if (keeperHasCyrillicLocal(text)) return pickKeeperFallbackLocal();
  return "I am Microsoft AI (local mode). Ask about capsules, letters, or settings.";
}

function tryLocalKeeperAnswerLocal(message) {
  const text = String(message || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (/(кто|что)\s+(ты|создал|делал|сделал)|какой\s+ты\s+ии|какая\s+ты\s+ии|microsoft|микрософт/.test(lower)) {
    return "Я Microsoft AI в локальном режиме. Работаю внутри DearFutureMe.";
  }
  if (/(привет|здравствуй|hello|hi|добрый)/.test(lower)) {
    return "Привет! Я Microsoft AI (локальный режим). Чем помочь?";
  }
  if (/спасибо|благодар/.test(lower)) {
    return "Пожалуйста! Если нужно, задайте еще вопрос.";
  }
  if (/премиум|подписк|тариф|оплат/.test(lower)) {
    return "Про премиум: в бесплатном плане доступна 1 капсула. Премиум снимает ограничения и открывает медиа.";
  }
  if (/когда|срок|дата|откроется|открытие/.test(lower)) {
    return "Проверь дату открытия в капсуле. Могу подсказать, где это посмотреть.";
  }

  const mathMatch = text.match(NUM_EXPR_RE);
  if (mathMatch) {
    const expr = mathMatch[1].replace(/\s+/g, "");
    if (NUM_EXPR_SAFE_RE.test(expr)) {
      try {
        const result = Function(`"use strict"; return (${expr});`)();
        if (Number.isFinite(result)) {
          return `Ответ: ${result}`;
        }
      } catch {
        // ignore
      }
    }
  }

  return keeperHasCyrillicLocal(text) ? pickKeeperQuoteLocal() : null;
}

// Keeper AI (clean helpers used by handlers)
const KEEPER_FALLBACKS_LOCAL_CLEAN = [
  "Я Microsoft AI (локальный режим). Задайте вопрос о капсулах, письмах или настройках.",
  "Могу помочь с письмами, датой открытия и правилами капсул. Что нужно?",
  "По сайту: регистрация, капсулы, премиум, карта — уточните.",
  "Готов объяснить, как работают капсулы и напоминания.",
  "Опишите проблему — отвечу кратко и по делу."
];
const KEEPER_QUOTES_LOCAL_CLEAN = [
  "Я Microsoft AI (локальный режим). Чем помочь?",
  "Сформулируйте вопрос — отвечу напрямую.",
  "Если нужен расчет или проверка, напишите запрос.",
  "Могу помочь с письмом, датой открытия или настройками."
];
const keeperHasCyrillicClean = (value) => /[\u0410-\u042F\u0430-\u044F\u0401\u0451]/.test(String(value || ""));
const pickKeeperFallbackClean = () =>
  KEEPER_FALLBACKS_LOCAL_CLEAN[Math.floor(Math.random() * KEEPER_FALLBACKS_LOCAL_CLEAN.length)];
const pickKeeperQuoteClean = () =>
  KEEPER_QUOTES_LOCAL_CLEAN[Math.floor(Math.random() * KEEPER_QUOTES_LOCAL_CLEAN.length)];

function craftKeeperReplyLocalClean(message) {
  const text = String(message || "").trim();
  if (!text) return pickKeeperFallbackClean();
  if (keeperHasCyrillicClean(text)) return pickKeeperFallbackClean();
  return "I am Microsoft AI (local mode). Ask about capsules, letters, or settings.";
}

function tryLocalKeeperAnswerLocalClean(message) {
  const text = String(message || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (/(кто|что)\s+(ты|создал|делал|сделал)|какой\s+ты\s+ии|какая\s+ты\s+ии|microsoft|майкрософт/.test(lower)) {
    return "Я Microsoft AI в локальном режиме. Работаю внутри DearFutureMe.";
  }
  if (/кто\s+создател(ь|и)\s+сайта|кто\s+создал\s+сайт/.test(lower)) {
    return "Сайт создан командой DearFutureMe.";
  }
  if (/(привет|здравствуй|hello|hi|добрый)/.test(lower)) {
    return "Привет! Я Microsoft AI (локальный режим). Чем помочь?";
  }
  if (/спасибо|благодар/.test(lower)) {
    return "Пожалуйста! Если нужно, задайте еще вопрос.";
  }
  if (/премиум|подписк|тариф|оплат/.test(lower)) {
    return "Про премиум: в бесплатном плане доступна 1 капсула. Премиум снимает ограничения и открывает медиа.";
  }
  if (/когда|срок|дата|откроется|открытие/.test(lower)) {
    return "Проверь дату открытия в карточке капсулы. Могу подсказать, где это посмотреть.";
  }

  const mathMatch = text.match(NUM_EXPR_RE);
  if (mathMatch) {
    const expr = mathMatch[1].replace(/\s+/g, "");
    if (NUM_EXPR_SAFE_RE.test(expr)) {
      try {
        const result = Function(`\"use strict\"; return (${expr});`)();
        if (Number.isFinite(result)) {
          return `Ответ: ${result}`;
        }
      } catch {
        // ignore
      }
    }
  }

  return keeperHasCyrillicClean(text) ? pickKeeperQuoteClean() : null;
}

const KEEPER_PHOTO_FALLBACK = "Фото получено. Я Microsoft AI (локальный режим). Чем помочь по изображению?";

async function callKeeperProviderGroq(prompt) {
  const models = Array.from(new Set([groqModel, "llama-3.1-8b-instant", "llama-3.3-70b-versatile"])).filter(Boolean);
  let lastError = null;

  for (const model of models) {
    const payload = {
      model,
      messages: [
        {
          role: "system",
          content:
            "You are Microsoft AI for DearFutureMe. Answer in the same language as the user. Be direct, professional, and concise. If asked who created the site, say: 'Сайт создан командой DearFutureMe.'"
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 220
    };

    try {
      const response = await fetch(groqEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Groq error: ${response.status} ${text}`);
      }

      const data = await response.json().catch(() => ({}));
      const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
      const trimmed = String(text || "").trim();
      if (trimmed) {
        return trimmed;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Groq error: empty response");
}

if (false) {
app.post("/api/keeper/chat", async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const localAnswer = tryLocalKeeperAnswerLocalClean(message);
  if (localAnswer) {
    return res.json({ reply: localAnswer, source: "local" });
  }

  if (keeperLocalOnlyMode || !groqApiKey) {
    return res.json({ reply: craftKeeperReplyLocalClean(message), source: "local" });
  }

  try {
    const reply = await callKeeperProviderGroq(message);
    return res.json({ reply: reply || craftKeeperReplyLocalClean(message), source: "groq" });
  } catch {
    return res.json({ reply: craftKeeperReplyLocalClean(message), source: "local" });
  }
});

app.post("/api/keeper/photo", async (req, res) => {
  const prompt = String(req.body.prompt || "").trim();
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  if (keeperLocalOnlyMode || !groqApiKey) {
    return res.json({
      reply: KEEPER_PHOTO_FALLBACK,
      source: "local"
    });
  }

  try {
    const reply = await callKeeperProviderGroq(prompt);
    return res.json({
      reply: reply || KEEPER_PHOTO_FALLBACK,
      source: "groq"
    });
  } catch {
    return res.json({
      reply: KEEPER_PHOTO_FALLBACK,
      source: "local"
    });
  }
});

}

if (false) {
// Keeper AI (clean, single implementation)
const KEEPER_FALLBACKS = [
  "Время — не прямая. Это спираль, где каждый вопрос возвращает тебя к себе.",
  "Будущее уже написано твоими шагами. Сделай следующий тихо и честно.",
  "Каждая секунда — письмо, которое ты отправляешь самому себе.",
  "Ответ живёт внутри вопроса. Я лишь помогаю тебе его услышать.",
  "Запечатай момент — и он станет якорем для будущего."
];

const KEEPER_QUOTES = [
  "Время хранит всё, что ты доверишь ему.",
  "Будущий ты уже ждёт это письмо.",
  "Каждый момент — шаг навстречу себе.",
  "Запечатай момент. Будущее доставит.",
  "Ты изменишься. И это прекрасно."
];

const keeperHasCyrillic = (value) => /[\u0410-\u042F\u0430-\u044F\u0401\u0451]/.test(String(value || ""));
const keeperLooksMojibake = (value) =>
  /(Р вЂњРЎвЂњ|Р вЂњРІР‚вЂљ|Р вЂњРЎвЂ™|Р вЂњРІР‚В|Р С—РЎвЂ”Р вЂ¦|Р“С“|Р“вЂљ|Р“С’|Р“вЂ|РїС—Р…)/.test(String(value || ""));

function pickKeeperFallback() {
  return KEEPER_FALLBACKS[Math.floor(Math.random() * KEEPER_FALLBACKS.length)];
}

function normalizeKeeperReply(message, reply) {
  const text = String(reply || "").trim();
  if (!text) return null;
  if (keeperLooksMojibake(text)) return null;
  if (!keeperHasCyrillic(text) && keeperHasCyrillic(message)) return null;
  return text;
}

function craftKeeperReply(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) return pickKeeperFallback();
  if (keeperHasCyrillic(trimmed)) {
    return KEEPER_QUOTES[Math.floor(Math.random() * KEEPER_QUOTES.length)];
  }
  return "I am the Keeper of time capsules. Ask in Russian, and I will answer.";
}

function tryLocalKeeperAnswer(message) {
  const msg = String(message || "").toLowerCase();
  if (/кто\s+создал|кто\s+тебя\s+создал|кто\s+твой\s+создатель/.test(msg)) {
    return "Меня создала команда Dear FutureMe, чтобы хранить ваши послания сквозь время.";
  }
  if (/кто\s+ты|как\s+тебя\s+зовут|ты\s+кто/.test(msg)) {
    return "Я — Хранитель капсул времени. Я помогаю твоим словам дойти до будущего.";
  }
  if (/привет|здравствуй|здравствуйте|хай|hi|hello/.test(msg)) {
    return "Привет. Я здесь, чтобы помочь тебе связаться с будущим.";
  }
  const mathMatch = msg.match(SIMPLE_MATH_RE);
  if (mathMatch) {
    const a = Number(mathMatch[1]);
    const b = Number(mathMatch[3]);
    const op = mathMatch[2];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      let result;
      switch (op) {
        case "+":
          result = a + b;
          break;
        case "-":
          result = a - b;
          break;
        case "*":
          result = a * b;
          break;
        case "/":
          result = b === 0 ? null : a / b;
          break;
        default:
          result = null;
      }
      if (result !== null) {
        return `Ответ: ${result}`;
      }
    }
  }
  return null;
}

// Local keeper mode (override with clean Russian replies)
const keeperLocalOnly = false;

function pickKeeperFallback() {
  const replies = [
    "Время — не прямая. Это спираль, где каждый вопрос возвращает тебя к себе.",
    "Будущее уже написано твоими шагами. Сделай следующий тихо и честно.",
    "Каждая секунда — письмо, которое ты отправляешь самому себе.",
    "Ответ живёт внутри вопроса. Я лишь помогаю тебе его услышать.",
    "Запечатай момент — и он станет якорем для будущего."
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function craftKeeperReply(message) {
  const text = String(message || "").trim();
  if (!text) return pickKeeperFallback();
  return pickKeeperFallback();
}

function tryLocalKeeperAnswer(message) {
  const msg = String(message || "").toLowerCase();
  if (/кто\s+создал|кто\s+тебя\s+создал|кто\s+твой\s+создатель/.test(msg)) {
    return "Меня создала команда Dear FutureMe, чтобы хранить ваши послания сквозь время.";
  }
  if (/кто\s+ты|как\s+тебя\s+зовут|ты\s+кто/.test(msg)) {
    return "Я — Хранитель капсул времени. Я помогаю твоим словам дойти до будущего.";
  }
  if (/привет|здравствуй|здравствуйте|хай|hi|hello/.test(msg)) {
    return "Привет. Я здесь, чтобы помочь тебе связаться с будущим.";
  }
  const mathMatch = msg.match(SIMPLE_MATH_RE);
  if (mathMatch) {
    const a = Number(mathMatch[1]);
    const b = Number(mathMatch[3]);
    const op = mathMatch[2];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      let result;
      switch (op) {
        case "+":
          result = a + b;
          break;
        case "-":
          result = a - b;
          break;
        case "*":
          result = a * b;
          break;
        case "/":
          result = b === 0 ? null : a / b;
          break;
        default:
          result = null;
      }
      if (result !== null) {
        return `Ответ: ${result}`;
      }
    }
  }
  return null;
}

function buildKeeperPrompt(message) {
  return [
    "Ты — Хранитель, мистический страж капсул времени Dear FutureMe.",
    "Отвечай по-русски, 1–3 предложения.",
    "Стиль: поэтично, спокойно, без жаргона и лишних эмоций.",
    "Если вопрос про факты или математику — отвечай прямо и кратко.",
    `Вопрос: ${String(message || "").slice(0, 800)}`
  ].join(" ");
}

app.post("/api/keeper/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message required" });

  const localAnswer = tryLocalKeeperAnswer(message);
  if (!deepseekKey && localAnswer) return res.json({ reply: localAnswer });
  if (keeperLocalOnly) return res.json({ reply: craftKeeperReply(message) });

  try {
    const reply = await callApiFreeLLM({ message: buildKeeperPrompt(message) });
    return res.json({ reply: normalizeKeeperReply(message, reply) || craftKeeperReply(message) });
  } catch (error) {
    return res.json({ reply: craftKeeperReply(message) });
  }
});

app.post("/api/keeper/photo", async (req, res) => {
  const caption = String(req.body?.caption || "").trim();
  if (keeperLocalOnly) {
    return res.json({ reply: craftKeeperReply(caption) });
  }
  const prompt = caption
    ? `Ты — Хранитель капсул времени. По описанию пользователя ответь поэтично (1–2 предложения). Описание: ${caption}`
    : "Ты — Хранитель капсул времени. Опиши фото поэтично в 1–2 предложениях.";
  try {
    const reply = await callApiFreeLLM({ message: prompt });
    return res.json({ reply: normalizeKeeperReply(caption, reply) || pickKeeperFallback() });
  } catch (error) {
    return res.json({ reply: pickKeeperFallback() });
  }
});

  if (false) {
// Clean keeper helpers (override mojibake)
const KEEPER_FALLBACKS_CLEAN = [
  "Время — не прямая. Это спираль, где каждый вопрос возвращает тебя к себе.",
  "Будущее уже написано твоими шагами. Сделай следующий тихо и честно.",
  "Каждая секунда — письмо, которое ты отправляешь самому себе.",
  "Ответ живёт внутри вопроса. Я лишь помогаю тебе его услышать.",
  "Запечатай момент — и он станет якорем для будущего."
];

function pickKeeperFallback() {
  return KEEPER_FALLBACKS_CLEAN[Math.floor(Math.random() * KEEPER_FALLBACKS_CLEAN.length)];
}

function hasCyrillic(text) {
  return /[А-Яа-яЁё]/.test(text || "");
}

function looksMojibake(text) {
  return /Гѓ|Г‚|Гђ|Г‘|пїЅ/.test(text || "");
}

function normalizeKeeperReply(_message, reply) {
  if (!reply) return null;
  const cleaned = String(reply).trim();
  if (!cleaned) return null;
  if (looksMojibake(cleaned)) return null;
  if (!hasCyrillic(cleaned)) return null;
  return cleaned;
}

function craftKeeperReply(message) {
  const text = String(message || "").trim();
  if (!text) return pickKeeperFallback();
  const short = text.length > 180 ? `${text.slice(0, 180)}…` : text;
  return `Ты спрашиваешь: «${short}». Ответ приходит тихо — в том, что ты уже делаешь сегодня.`;
}

function tryLocalKeeperAnswer(message) {
  const text = String(message || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (/кто\s+создал|кто\s+тебя\s+создал|кто\s+твой\s+создател/.test(lower)) {
    return "Меня создала команда Dear FutureMe, чтобы хранить ваши послания сквозь время.";
  }
  if (/кто\s+ты|как\s+тебя\s+зовут|ты\s+кто/.test(lower)) {
    return "Я — Хранитель капсул времени. Я помогаю твоим словам дойти до будущего.";
  }
  if (/привет|здравствуй|здравствуйте|хай|hi|hello/.test(lower)) {
    return "Привет. Я здесь, чтобы помочь тебе связаться с будущим.";
  }

  const mathMatch = text.match(NUM_EXPR_RE);
  if (mathMatch) {
    const expr = mathMatch[1].replace(/\s+/g, "");
    if (NUM_EXPR_SAFE_RE.test(expr) && expr.length <= 40) {
      try {
        const result = Function(`"use strict";return (${expr});`)();
        if (Number.isFinite(result)) {
          return `Ответ: ${result}`;
        }
      } catch (_) {
        // ignore eval errors
      }
    }
  }

  return null;
}

if (false) {
// Override keeper helpers with clean Russian text (avoid mojibake fallbacks)
hasCyrillic = (text) => /[\u0410-\u042F\u0430-\u044F\u0401\u0451]/.test(text || "");
looksMojibake = (text) => /Гѓ|Г‚|Гђ|Г‘|пїЅ/.test(text || "");
normalizeKeeperReply = (message, reply) => {
  if (!reply) return null;
  const cleaned = String(reply).trim();
  if (!cleaned) return null;
  if (looksMojibake(cleaned)) return null;
  if (!hasCyrillic(cleaned)) return null;
  return cleaned;
};
pickKeeperFallback = function () {
  const replies = [
    "\u0412\u0440\u0435\u043c\u044f \u2014 \u043d\u0435 \u043f\u0440\u044f\u043c\u0430\u044f. \u042d\u0442\u043e \u0441\u043f\u0438\u0440\u0430\u043b\u044c, \u0433\u0434\u0435 \u043a\u0430\u0436\u0434\u044b\u0439 \u0432\u043e\u043f\u0440\u043e\u0441 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0442\u0435\u0431\u044f \u043a \u0441\u0435\u0431\u0435.",
    "\u0411\u0443\u0434\u0443\u0449\u0435\u0435 \u0443\u0436\u0435 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043e \u0442\u0432\u043e\u0438\u043c\u0438 \u0448\u0430\u0433\u0430\u043c\u0438. \u0421\u0434\u0435\u043b\u0430\u0439 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0442\u0438\u0445\u043e \u0438 \u0447\u0435\u0441\u0442\u043d\u043e.",
    "\u041a\u0430\u0436\u0434\u0430\u044f \u0441\u0435\u043a\u0443\u043d\u0434\u0430 \u2014 \u043f\u0438\u0441\u044c\u043c\u043e, \u043a\u043e\u0442\u043e\u0440\u043e\u0435 \u0442\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u0448\u044c \u0441\u0430\u043c\u043e\u043c\u0443 \u0441\u0435\u0431\u0435.",
    "\u041e\u0442\u0432\u0435\u0442 \u0436\u0438\u0432\u0451\u0442 \u0432\u043d\u0443\u0442\u0440\u0438 \u0432\u043e\u043f\u0440\u043e\u0441\u0430. \u042f \u043b\u0438\u0448\u044c \u043f\u043e\u043c\u043e\u0433\u0430\u044e \u0442\u0435\u0431\u0435 \u0435\u0433\u043e \u0443\u0441\u043b\u044b\u0448\u0430\u0442\u044c.",
    "\u0417\u0430\u043f\u0435\u0447\u0430\u0442\u0430\u0439 \u043c\u043e\u043c\u0435\u043d\u0442 \u2014 \u0438 \u043e\u043d \u0441\u0442\u0430\u043d\u0435\u0442 \u044f\u043a\u043e\u0440\u0435\u043c \u0434\u043b\u044f \u0431\u0443\u0434\u0443\u0449\u0435\u0433\u043e."
  ];
  return replies[Math.floor(Math.random() * replies.length)];
};
tryLocalKeeperAnswer = function (message) {
  const text = String(message || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/кто\\s+создал|кто\\s+тебя\\s+создал|кто\\s+твой\\s+создатель/.test(lower)) {
    return "\u041c\u0435\u043d\u044f \u0441\u043e\u0437\u0434\u0430\u043b\u0430 \u043a\u043e\u043c\u0430\u043d\u0434\u0430 Dear FutureMe, \u0447\u0442\u043e\u0431\u044b \u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432\u0430\u0448\u0438 \u043f\u043e\u0441\u043b\u0430\u043d\u0438\u044f \u0441\u043a\u0432\u043e\u0437\u044c \u0432\u0440\u0435\u043c\u044f.";
  }
  if (/кто\\s+ты|как\\s+тебя\\s+зовут|ты\\s+кто/.test(lower)) {
    return "\u042f \u2014 \u0425\u0440\u0430\u043d\u0438\u0442\u0435\u043b\u044c \u043a\u0430\u043f\u0441\u0443\u043b \u0432\u0440\u0435\u043c\u0435\u043d\u0438. \u042f \u043f\u043e\u043c\u043e\u0433\u0430\u044e \u0442\u0432\u043e\u0438\u043c \u0441\u043b\u043e\u0432\u0430\u043c \u0434\u043e\u0439\u0442\u0438 \u0434\u043e \u0431\u0443\u0434\u0443\u0449\u0435\u0433\u043e.";
  }
  if (/привет|здравствуй|здравствуйте|хай|hi|hello/.test(lower)) {
    return "\u041f\u0440\u0438\u0432\u0435\u0442. \u042f \u0437\u0434\u0435\u0441\u044c, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043c\u043e\u0447\u044c \u0442\u0435\u0431\u0435 \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u0431\u0443\u0434\u0443\u0449\u0438\u043c.";
  }
  const mathMatch = text.match(NUM_EXPR_RE);
  if (mathMatch) {
    const expr = mathMatch[1].replace(/\\s+/g, "");
    if (NUM_EXPR_SAFE_RE.test(expr) && expr.length <= 40) {
      try {
        const result = Function(`\"use strict\";return (${expr});`)();
        if (Number.isFinite(result)) return `\u041e\u0442\u0432\u0435\u0442: ${result}`;
      } catch (_) {}
    }
  }
  return null;
};
craftKeeperReply = function (message) {
  const text = String(message || "").trim();
  if (!text) return pickKeeperFallback();
  return pickKeeperFallback();
};

app.post("/api/keeper/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message required" });
  const prompt = `Ты — Хранитель капсул времени Dear FutureMe. Отвечай по-русски, 1-3 предложения, поэтично и мягко.\nВопрос: ${message}`;
  try {
    const reply = await callApiFreeLLM({ message: prompt });
    res.json({ reply: reply || pickKeeperFallback() });
  } catch (error) {
    res.json({ reply: pickKeeperFallback(), note: "fallback" });
  }
});

app.post("/api/keeper/photo", async (req, res) => {
  const caption = String(req.body?.caption || "").trim();
  const prompt = caption
    ? `Ты — Хранитель капсул времени. По описанию пользователя ответь поэтично (1-2 предложения).\nОписание: ${caption}`
    : "Ты — Хранитель капсул времени. Опиши фото поэтично в 1-2 предложениях, даже если видишь его лишь как тень воспоминания.";
  try {
    const reply = await callApiFreeLLM({ message: prompt });
    res.json({ reply: reply || pickKeeperFallback() });
  } catch (error) {
    res.json({ reply: pickKeeperFallback(), note: "fallback" });
  }
});
}

function pickKeeperFallback() {
  const replies = [
    "Время — не прямая. Это спираль, где каждый вопрос возвращает тебя к себе.",
    "Будущее уже написано твоими шагами. Сделай следующий тихо и честно.",
    "Каждая секунда — письмо, которое ты отправляешь самому себе.",
    "Ответ живёт внутри вопроса. Я лишь помогаю тебе его услышать.",
    "Запечатай момент — и он станет якорем для будущего."
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function tryLocalKeeperAnswer(message) {
  const text = String(message || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (/кто\s+создал|кто\s+тебя\s+создал|кто\s+твой\s+создател/.test(lower)) {
    return "Меня создали люди и команда Dear FutureMe, чтобы хранить ваши послания сквозь время.";
  }
  if (/кто\s+ты|как\s+тебя\s+зовут|ты\s+кто/.test(lower)) {
    return "Я — Хранитель капсул времени. Я помогаю твоим словам дойти до будущего.";
  }
  if (/привет|здравствуй|здравствуйте|хай|hi|hello/.test(lower)) {
    return "Привет. Я здесь, чтобы помочь тебе связаться с будущим.";
  }

  const mathMatch = text.match(NUM_EXPR_RE);
  if (mathMatch) {
    const expr = mathMatch[1].replace(/\s+/g, "");
    if (NUM_EXPR_SAFE_RE.test(expr) && expr.length <= 40) {
      try {
        const result = Function(`"use strict";return (${expr});`)();
        if (Number.isFinite(result)) {
          return `Ответ: ${result}`;
        }
      } catch (_) {
        // ignore eval errors
      }
    }
  }

  return null;
}

// Override mojibake keeper helpers with clean Russian text.
function hasCyrillic(text) {
  return /[А-Яа-яЁё]/.test(text || "");
}

function looksMojibake(text) {
  return /Ã|Â|Ð|Ñ|�/.test(text || "");
}

function normalizeKeeperReply(_message, reply) {
  if (!reply) return null;
  const cleaned = String(reply).trim();
  if (!cleaned) return null;
  if (looksMojibake(cleaned)) return null;
  if (!hasCyrillic(cleaned)) return null;
  return cleaned;
}

function craftKeeperReply(message) {
  const text = String(message || "").trim();
  if (!text) return pickKeeperFallback();
  const short = text.length > 180 ? `${text.slice(0, 180)}…` : text;
  return `Ты спрашиваешь: «${short}». Ответ приходит тихо — в том, что ты уже делаешь сегодня.`;
}

function pickKeeperFallback() {
  const replies = [
    "Время — не прямая. Это спираль, где каждый вопрос возвращает тебя к себе.",
    "Будущее уже написано твоими шагами. Сделай следующий тихо и честно.",
    "Каждая секунда — письмо, которое ты отправляешь самому себе.",
    "Ответ живёт внутри вопроса. Я лишь помогаю тебе его услышать.",
    "Запечатай момент — и он станет якорем для будущего."
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function tryLocalKeeperAnswer(message) {
  const text = String(message || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (/кто\s+создал|кто\s+тебя\s+создал|кто\s+твой\s+создател/.test(lower)) {
    return "Меня создала команда Dear FutureMe, чтобы хранить ваши послания сквозь время.";
  }
  if (/кто\s+ты|как\s+тебя\s+зовут|ты\s+кто/.test(lower)) {
    return "Я — Хранитель капсул времени. Я помогаю твоим словам дойти до будущего.";
  }
  if (/привет|здравствуй|здравствуйте|хай|hi|hello/.test(lower)) {
    return "Привет. Я здесь, чтобы помочь тебе связаться с будущим.";
  }

  const mathMatch = text.match(NUM_EXPR_RE);
  if (mathMatch) {
    const expr = mathMatch[1].replace(/\s+/g, "");
    if (NUM_EXPR_SAFE_RE.test(expr) && expr.length <= 40) {
      try {
        const result = Function(`"use strict";return (${expr});`)();
        if (Number.isFinite(result)) {
          return `Ответ: ${result}`;
        }
      } catch (_) {
        // ignore eval errors
      }
    }
  }

  return null;
}

app.post("/api/keeper/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message required" });
  const localAnswer = tryLocalKeeperAnswer(message);
  if (localAnswer) return res.json({ reply: localAnswer, source: "local" });

  const prompt = [
    "You are the Keeper of Dear FutureMe time capsules.",
    "Reply in Russian with 1-3 poetic sentences.",
    "If the question is factual or math, answer directly and briefly.",
    `Question: ${message}`
  ].join("\n");

  try {
    const apiReply = await callApiFreeLLM({ message: prompt });
    const reply = normalizeKeeperReply(message, apiReply) || craftKeeperReply(message);
    return res.json({ reply });
  } catch (error) {
    return res.json({ reply: craftKeeperReply(message), note: "fallback" });
  }
});

app.post("/api/keeper/photo", async (req, res) => {
  const caption = String(req.body?.caption || "").trim();
  const prompt = [
    "You are the Keeper of Dear FutureMe time capsules.",
    "A user has sent a photo.",
    "Respond in Russian with 1-3 poetic sentences based on the photo or caption.",
    caption ? `Caption: ${caption}` : ""
  ].filter(Boolean).join("\n");
  try {
    const apiReply = await callApiFreeLLM({ message: prompt });
    const reply = normalizeKeeperReply(caption, apiReply) || "Этот образ останется с тобой — как светлый след в капсуле времени.";
    return res.json({ reply });
  } catch (error) {
    return res.json({ reply: "Этот образ останется с тобой — как светлый след в капсуле времени." });
  }
});

if (false) {

const KEEPER_FALLBACKS = [
  "Время — не прямая. Это спираль, где каждый вопрос возвращает тебя к себе.",
  "Будущее уже написано твоими шагами. Сделай следующий тихо и честно.",
  "Каждая секунда — письмо, которое ты отправляешь самому себе.",
  "Ответ живёт внутри вопроса. Я лишь помогаю тебе его услышать.",
  "Запечатай момент — и он станет якорем для будущего."
];

const KEEPER_QUOTES = [
  "Время хранит всё, что ты доверишь ему.",
  "Будущий ты уже ждёт это письмо.",
  "Каждый момент — шаг навстречу себе.",
  "Запечатай момент. Будущее доставит.",
  "Ты изменишься. И это прекрасно."
];

const hasCyrillic = (value) => /[\u0410-\u042F\u0430-\u044F\u0401\u0451]/.test(String(value || ""));
const looksMojibake = (value) => /(Р“С“|Р“вЂ‚|Р“С’|Р“вЂ|РїС—Р…|Гѓ|Г‚|Гђ|Г‘|пїЅ)/.test(String(value || ""));

function pickKeeperFallback() {
  return KEEPER_FALLBACKS[Math.floor(Math.random() * KEEPER_FALLBACKS.length)];
}

function normalizeKeeperReply(message, reply) {
  const text = String(reply || "").trim();
  if (!text) return null;
  if (looksMojibake(text)) return null;
  if (!hasCyrillic(text) && hasCyrillic(message)) return null;
  return text;
}

function craftKeeperReply(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) return pickKeeperFallback();
  if (hasCyrillic(trimmed)) {
    return KEEPER_QUOTES[Math.floor(Math.random() * KEEPER_QUOTES.length)];
  }
  return "I am the Keeper of time capsules. Ask in Russian, and I will answer.";
}

function tryLocalKeeperAnswer(message) {
  const msg = String(message || "").toLowerCase();
  if (/кто\s+созда/.test(msg)) {
    return "Меня создала команда Dear FutureMe, чтобы хранить ваши послания сквозь время.";
  }
  if (/кто\s+ты|что\s+ты|ты\s+кто/.test(msg)) {
    return "Я — Хранитель капсул времени. Я помогаю твоим словам дойти до будущего.";
  }
  if (/привет|здравствуй|hello|hi/.test(msg)) {
    return "Привет. Я здесь, чтобы помочь тебе связаться с будущим.";
  }
  const mathMatch = msg.match(SIMPLE_MATH_RE);
  if (mathMatch) {
    const a = Number(mathMatch[1]);
    const b = Number(mathMatch[3]);
    const op = mathMatch[2];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      let result;
      switch (op) {
        case "+":
          result = a + b;
          break;
        case "-":
          result = a - b;
          break;
        case "*":
          result = a * b;
          break;
        case "/":
          result = b === 0 ? null : a / b;
          break;
        default:
          result = null;
      }
      if (result !== null) {
        return `Ответ: ${result}`;
      }
    }
  }
  return null;
}

function buildKeeperMessages(message) {
  const system = [
    "Ты — Хранитель, мистический страж капсул времени Dear FutureMe.",
    "Отвечай по-русски, 1-3 предложения.",
    "Стиль: поэтично, спокойно, без жаргона и лишних эмоций.",
    "Если вопрос про факты или математику — отвечай прямо и кратко."
  ].join(" ");
  return [
    { role: "system", content: system },
    { role: "user", content: String(message || "").slice(0, 800) }
  ];
}

app.post("/api/keeper/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message required" });
  const localAnswer = tryLocalKeeperAnswer(message);
  if (localAnswer) return res.json({ reply: localAnswer });
  try {
    const apiReply = await callApiFreeLLM({ messages: buildKeeperMessages(message) });
    const reply = normalizeKeeperReply(message, apiReply);
    return res.json({ reply: reply || craftKeeperReply(message) });
  } catch (error) {
    return res.json({ reply: craftKeeperReply(message) });
  }
});

app.post("/api/keeper/photo", async (req, res) => {
  const caption = String(req.body?.caption || "").trim();
  if (!caption) {
    return res.json({ reply: "Этот образ останется с тобой — как светлый след в капсуле времени." });
  }
  try {
    const apiReply = await callApiFreeLLM({
      messages: [
        {
          role: "system",
          content:
            "Ты — Хранитель капсул времени. Опиши фото поэтично, 2-3 предложения. По-русски."
        },
        {
          role: "user",
          content: caption.slice(0, 800)
        }
      ]
    });
    const reply = normalizeKeeperReply(caption, apiReply);
    return res.json({ reply: reply || "Этот образ останется с тобой — как светлый след в капсуле времени." });
  } catch (error) {
    return res.json({ reply: "Этот образ останется с тобой — как светлый след в капсуле времени." });
  }
});

}

}

}

app.post("/api/auth/request-code", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!name || !email || password.length < 6 || !isValidUserName(name)) {
    return res.status(400).json({ error: "Invalid registration payload" });
  }

  const store = await readStore();
  cleanupPendingRegistrations(store);
  const exists = store.users.find((user) => user.email === email);
  if (exists) {
    return res.status(409).json({ error: "User already exists" });
  }

  const code = buildVerificationCode();
  const passwordHash = await bcrypt.hash(password, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const existingPending = store.pendingRegistrations.find((entry) => entry.email === email);
  const pending = {
    id: existingPending?.id || crypto.randomUUID(),
    name,
    email,
    passwordHash,
    codeHash: hashVerificationCode(code),
    expiresAt,
    createdAt: existingPending?.createdAt || new Date().toISOString()
  };

  store.pendingRegistrations = store.pendingRegistrations.filter((entry) => entry.email !== email);
  store.pendingRegistrations.push(pending);
  await writeStore(store);

  const emailResult = await sendVerificationCodeEmail({ email, name, code });
  const payload = {
    ok: true,
    expiresAt,
    emailSent: emailResult.delivered
  };
  if (!emailResult.delivered) {
    payload.note = emailResult.reason;
    if (allowTestCodes) {
      payload.verificationCode = code;
    }
  }

  res.status(200).json(payload);
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || "").trim();

  if (!email || !code) {
    return res.status(400).json({ error: "Invalid verification payload" });
  }

  const store = await readStore();
  cleanupPendingRegistrations(store);
  const pending = store.pendingRegistrations.find((entry) => entry.email === email);
  if (!pending) {
    await writeStore(store);
    return res.status(400).json({ error: "Verification code expired or missing" });
  }

  if (pending.codeHash !== hashVerificationCode(code)) {
    return res.status(400).json({ error: "Invalid verification code" });
  }

  const user = {
    id: crypto.randomUUID(),
    name: pending.name,
    email: pending.email,
    passwordHash: pending.passwordHash,
    createdAt: new Date().toISOString(),
    premiumUntil: null,
    premiumSource: null
  };

  store.pendingRegistrations = store.pendingRegistrations.filter((entry) => entry.email !== email);
  store.users.push(user);
  await writeStore(store);
  await sendWelcomeEmail({ email: user.email, name: user.name });

  res.status(201).json({
    token: issueToken(user),
    user: publicUser(user)
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const store = await readStore();
  const user = store.users.find((entry) => entry.email === email);

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({
    token: issueToken(user),
    user: publicUser(user)
  });
});

app.post("/api/auth/request-reset", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const store = await readStore();
  cleanupPendingPasswordResets(store);
  const user = store.users.find((entry) => entry.email === email);
  if (!user) {
    await writeStore(store);
    return res.status(404).json({ error: "User not found" });
  }

  const code = buildVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const existing = store.pendingPasswordResets.find((entry) => entry.email === email);
  const pending = {
    id: existing?.id || crypto.randomUUID(),
    email,
    codeHash: hashVerificationCode(code),
    expiresAt,
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  store.pendingPasswordResets = store.pendingPasswordResets.filter((entry) => entry.email !== email);
  store.pendingPasswordResets.push(pending);
  await writeStore(store);

  const emailResult = await sendPasswordResetEmail({ email, name: user.name, code });
  const payload = {
    ok: true,
    expiresAt,
    emailSent: emailResult.delivered
  };
  if (!emailResult.delivered) {
    payload.note = emailResult.reason;
    if (allowTestCodes) {
      payload.resetCode = code;
    }
  }

  res.status(200).json(payload);
});

app.post("/api/auth/reset-password", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || "").trim();
  const password = String(req.body.password || "");

  if (!email || !code || password.length < 6) {
    return res.status(400).json({ error: "Invalid reset payload" });
  }

  const store = await readStore();
  cleanupPendingPasswordResets(store);
  const pending = store.pendingPasswordResets.find((entry) => entry.email === email);
  if (!pending) {
    await writeStore(store);
    return res.status(400).json({ error: "Reset code expired or missing" });
  }

  if (pending.codeHash !== hashVerificationCode(code)) {
    return res.status(400).json({ error: "Invalid reset code" });
  }

  const user = store.users.find((entry) => entry.email === email);
  if (!user) {
    await writeStore(store);
    return res.status(404).json({ error: "User not found" });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  store.pendingPasswordResets = store.pendingPasswordResets.filter((entry) => entry.email !== email);
  await writeStore(store);

  res.json({ ok: true });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/admin/stats", authRequired, adminRequired, async (req, res) => {
  const store = await readStore();
  const stats = getStats(store);
  const publicCapsules = store.capsules.filter((capsule) => capsule.visibility === "public").length;
  const premiumUsers = store.users.filter((user) => user.premiumUntil && new Date(user.premiumUntil).getTime() > Date.now()).length;
  const unusedPromoCodes = store.promoCodes.filter((promo) => !promo.usedBy && !promo.disabledAt).length;
  res.json({
    users: store.users.length,
    premiumUsers,
    publicCapsules,
    sealed: stats.sealed,
    delivered: stats.delivered,
    unusedPromoCodes
  });
});

app.post("/api/admin/promo/generate", async (req, res) => {
  const duration = String(req.body.duration || "month").trim().toLowerCase();
  if (!["month", "year"].includes(duration)) {
    return res.status(400).json({ error: "Invalid promo duration" });
  }

  const store = await readStore();
  const promo = {
    id: crypto.randomUUID(),
    code: buildPromoCode(duration),
    duration,
    createdAt: new Date().toISOString(),
    usedBy: null,
    usedAt: null,
    disabledAt: null,
    disabledBy: null
  };
  store.promoCodes.push(promo);
  await writeStore(store);

  res.status(201).json({
    promo: {
      code: promo.code,
      duration: promo.duration,
      durationLabel: promoDurationLabel(promo.duration)
    }
  });
});

app.post("/api/promo/activate", authRequired, async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "Promo code is required" });
  }

  const store = await readStore();
  const promo = store.promoCodes.find((entry) => entry.code === code);
  if (!promo) {
    return res.status(404).json({ error: "Promo code not found" });
  }
  if (promo.disabledAt) {
    return res.status(409).json({ error: "Promo code is disabled" });
  }
  if (promo.usedBy) {
    return res.status(409).json({ error: "Promo code already used" });
  }

  const user = store.users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const startDate = user.premiumUntil && new Date(user.premiumUntil).getTime() > Date.now()
    ? new Date(user.premiumUntil)
    : new Date();
  const premiumUntil = addMonths(startDate, promoDurationMonths(promo.duration)).toISOString();

  user.premiumUntil = premiumUntil;
  user.premiumSource = `promo:${promo.code}`;
  promo.usedBy = user.id;
  promo.usedAt = new Date().toISOString();
  await writeStore(store);

  res.json({
    ok: true,
    duration: promo.duration,
    durationLabel: promoDurationLabel(promo.duration),
    user: publicUser(user)
  });
});


app.post("/api/admin/promo/disable", async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "Promo code is required" });
  }

  const store = await readStore();
  const promo = store.promoCodes.find((entry) => entry.code === code);
  if (!promo) {
    return res.status(404).json({ error: "Promo code not found" });
  }
  if (promo.disabledAt) {
    return res.json({ ok: true, code, alreadyDisabled: true });
  }

  promo.disabledAt = new Date().toISOString();
  promo.disabledBy = (req.user && req.user.id) ? req.user.id : "admin";

  // Revoke premium for users who activated this promo code.
  const promoSource = `promo:${code}`;
  let revokedCount = 0;
  if (Array.isArray(store.users)) {
    store.users.forEach((user) => {
      if (user && user.premiumSource === promoSource) {
        user.premiumUntil = null;
        user.premiumSource = null;
        revokedCount += 1;
      }
    });
  }

  await writeStore(store);

  res.json({ ok: true, code, revokedCount });
});

app.post("/api/admin/promo/delete", async (req, res) => {
  try {
    const store = await readStore();
    const rawCode = String(req.body && req.body.code ? req.body.code : "").trim();
    const code = rawCode.toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "Promo code required" });
    }
    const promos = Array.isArray(store.promoCodes) ? store.promoCodes : [];
    const idx = promos.findIndex((p) => String(p.code || "").toUpperCase() === code);
    if (idx === -1) {
      return res.status(404).json({ error: "Promo code not found" });
    }
    const removed = promos.splice(idx, 1)[0];
    store.promoCodes = promos;
    await writeStore(store);
    return res.json({
      ok: true,
      code,
      removed: {
        code: removed && removed.code,
        duration: removed && removed.duration,
        createdAt: removed && removed.createdAt
      }
    });
  } catch (e) {
    return res.status(500).json({ error: "Unable to delete promo" });
  }
});

app.get("/api/admin/profile", async (_req, res) => {
  const store = await readStore();
  res.json({ profile: store.adminProfile || { ...defaultStore.adminProfile } });
});

app.post("/api/admin/profile", async (req, res) => {
  try {
    const store = await readStore();
    const payload = req.body || {};
    store.adminProfile = {
      ...defaultStore.adminProfile,
      ...store.adminProfile,
      firstName: String(payload.firstName || "").trim() || store.adminProfile?.firstName || defaultStore.adminProfile.firstName,
      lastName: String(payload.lastName || "").trim() || store.adminProfile?.lastName || defaultStore.adminProfile.lastName,
      email: String(payload.email || "").trim() || store.adminProfile?.email || defaultStore.adminProfile.email,
      avatar: typeof payload.avatar === "string" ? payload.avatar : (store.adminProfile?.avatar || "")
    };
    await writeStore(store);
    res.json({ ok: true, profile: store.adminProfile });
  } catch (error) {
    res.status(500).json({ error: "Unable to save profile" });
  }
});

app.get("/api/admin/settings", async (_req, res) => {
  const store = await readStore();
  res.json({ settings: store.adminSettings || { ...defaultStore.adminSettings } });
});

app.post("/api/admin/settings", async (req, res) => {
  try {
    const store = await readStore();
    const payload = req.body || {};
    store.adminSettings = {
      ...defaultStore.adminSettings,
      ...store.adminSettings,
      siteName: String(payload.siteName || "").trim() || store.adminSettings?.siteName || defaultStore.adminSettings.siteName,
      supportEmail: String(payload.supportEmail || "").trim() || store.adminSettings?.supportEmail || defaultStore.adminSettings.supportEmail
    };
    await writeStore(store);
    res.json({ ok: true, settings: store.adminSettings });
  } catch (error) {
    res.status(500).json({ error: "Unable to save settings" });
  }
});

app.get("/api/reviews", async (req, res) => {
  const store = await readStore();
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
  const items = (Array.isArray(store.reviews) ? store.reviews : [])
    .filter((r) => !r.deletedAt)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
  res.json({ items });
});

app.get("/api/reviews/mine", authRequired, async (req, res) => {
  const store = await readStore();
  const items = Array.isArray(store.reviews) ? store.reviews : [];
  const hasReview = items.some((r) => r && !r.deletedAt && String(r.userId || "") === String(req.user.id || ""));
  res.json({ hasReview });
});

app.post("/api/reviews", authRequired, async (req, res) => {
  const rating = Number(req.body.rating || 0);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Invalid rating" });
  }
  const text = String(req.body.text || "").trim();
  const store = await readStore();
  const existingReview = (Array.isArray(store.reviews) ? store.reviews : []).find(
    (r) => r && !r.deletedAt && String(r.userId || "") === String(req.user.id || "")
  );
  if (existingReview) {
    return res.status(409).json({ error: "Review already exists" });
  }
  const author = String(req.body.author || req.user.name || req.user.email || "Пользователь").trim();
  const review = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    name: author,
    author,
    email: req.user.email || "",
    rating,
    text,
    status: "published",
    createdAt: new Date().toISOString()
  };
  store.reviews = Array.isArray(store.reviews) ? store.reviews : [];
  store.reviews.push(review);
  await writeStore(store);
  res.status(201).json({ review });
});

app.get("/api/admin/reviews", authRequired, adminRequired, async (req, res) => {
  const store = await readStore();
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
  const items = (Array.isArray(store.reviews) ? store.reviews : [])
    .filter((r) => !r.deletedAt)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
  res.json({ items });
});

app.post("/api/admin/reviews/delete", authRequired, adminRequired, async (req, res) => {
  try {
    const store = await readStore();
    const id = String(req.body && req.body.id ? req.body.id : "").trim();
    if (!id) {
      return res.status(400).json({ error: "Review id required" });
    }
    const reviews = Array.isArray(store.reviews) ? store.reviews : [];
    const activeReviews = reviews.filter((r) => !r.deletedAt);
    const review = reviews.find((r) => String(r.id) === id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }
    review.deletedAt = new Date().toISOString();
    review.deletedBy = (req.user && req.user.id) ? req.user.id : "admin";
    store.reviews = reviews;
    await writeStore(store);
    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ error: "Unable to delete review" });
  }
});

app.post("/api/admin/users/update", authRequired, adminRequired, async (req, res) => {
  try {
    const store = await readStore();
    const id = String(req.body && req.body.id ? req.body.id : "").trim();
    if (!id) {
      return res.status(400).json({ error: "User id required" });
    }
    const user = (Array.isArray(store.users) ? store.users : []).find((u) => String(u.id) === id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (req.body && typeof req.body.name === "string") {
      user.name = String(req.body.name || "").trim();
    }
    if (req.body && typeof req.body.email === "string") {
      user.email = normalizeEmail(req.body.email || "");
    }
    await writeStore(store);
    return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    return res.status(500).json({ error: "Unable to update user" });
  }
});

app.post("/api/admin/users/block", authRequired, adminRequired, async (req, res) => {
  try {
    const store = await readStore();
    const id = String(req.body && req.body.id ? req.body.id : "").trim();
    const blocked = Boolean(req.body && req.body.blocked);
    if (!id) {
      return res.status(400).json({ error: "User id required" });
    }
    const user = (Array.isArray(store.users) ? store.users : []).find((u) => String(u.id) === id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (blocked) {
      user.blockedAt = new Date().toISOString();
      user.status = "blocked";
    } else {
      user.blockedAt = null;
      if (user.status === "blocked") user.status = "active";
    }
    await writeStore(store);
    return res.json({ ok: true, id, blocked });
  } catch (e) {
    return res.status(500).json({ error: "Unable to update user status" });
  }
});


app.get("/api/admin/dashboard", async (req, res) => {
  try {
    const store = await readStore();
    const now = new Date();
    const msDay = 24 * 60 * 60 * 1000;
    const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = (d) =>
      d.toLocaleString("ru-RU", { month: "short" }) + " " + String(d.getFullYear()).slice(-2);
    const users = (Array.isArray(store.users) ? store.users : []).filter((u) => u && typeof u === "object");
    const capsules = (Array.isArray(store.capsules) ? store.capsules : []).filter((c) => c && typeof c === "object");
    const promoCodes = (Array.isArray(store.promoCodes) ? store.promoCodes : []).filter((p) => p && typeof p === "object");
    const reviews = (Array.isArray(store.reviews) ? store.reviews : []).filter((r) => r && typeof r === "object");
    const userCreatedAtById = new Map();
    const firstCapsuleByUser = new Map();
    capsules.forEach((c) => {
      if (!c.userId || !c.createdAt) return;
      const t = new Date(c.createdAt).getTime();
      if (!Number.isFinite(t)) return;
      const prev = firstCapsuleByUser.get(c.userId);
      if (!prev || t < prev) firstCapsuleByUser.set(c.userId, t);
    });
    users.forEach((u) => {
      let t = u.createdAt ? new Date(u.createdAt).getTime() : NaN;
      if (!Number.isFinite(t)) {
        const fromCaps = firstCapsuleByUser.get(u.id);
        t = Number.isFinite(fromCaps) ? fromCaps : now.getTime();
      }
      userCreatedAtById.set(u.id, new Date(t).toISOString());
    });
    const activeReviews = reviews.filter((r) => !r.deletedAt);

    const isPremium = (user) => {
      if (!user || !user.premiumUntil) return false;
      return new Date(user.premiumUntil).getTime() > now.getTime();
    };

    const premiumUsers = users.filter(isPremium).length;
    const blockedUsers = users.filter((u) => u.blockedAt || u.status === "blocked" || u.isBlocked).length;
    const publicCapsules = capsules.filter((c) => c.visibility === "public").length;
    const deliveredTotal = capsules.filter((c) => c.deliveredAt).length;
    const deliveredToday = capsules.filter((c) => {
      if (!c.deliveredAt) return false;
      const d = new Date(c.deliveredAt);
      return d.toDateString() === now.toDateString();
    }).length;
    const registrationsToday = users.filter((u) => {
      if (!u.createdAt) return false;
      return new Date(u.createdAt).toDateString() === now.toDateString();
    }).length;
    const capsulesCreatedToday = capsules.filter((c) => {
      if (!c.createdAt) return false;
      return new Date(c.createdAt).toDateString() === now.toDateString();
    }).length;
    const pendingDelivery = capsules.filter((c) => {
      if (c.deliveredAt) return false;
      if (!c.openDate) return false;
      return new Date(c.openDate).getTime() > now.getTime();
    }).length;
    const secretCapsules = capsules.filter((c) => c.secretHash).length;
    const totalCapsules = capsules.length;

    const newUsersMonth = users.filter((u) => {
      const createdAt = userCreatedAtById.get(u.id);
      if (!createdAt) return false;
      return now.getTime() - new Date(createdAt).getTime() <= 30 * msDay;
    }).length;

    const activeUsers30 = new Set(
      capsules
        .filter((c) => c.createdAt && now.getTime() - new Date(c.createdAt).getTime() <= 30 * msDay)
        .map((c) => c.userId)
    ).size;

    const conversion = users.length ? Number(((premiumUsers / users.length) * 100).toFixed(1)) : 0;
    const unusedPromoCodes = promoCodes.filter((promo) => !promo.usedBy && !promo.disabledAt).length;

    const typeCounts = { text: 0, photo: 0, voice: 0, secret: 0 };
    capsules.forEach((c) => {
      if (c.secretHash) typeCounts.secret += 1;
      else if (c.audioUrl) typeCounts.voice += 1;
      else if (c.photoUrl || c.videoUrl) typeCounts.photo += 1;
      else typeCounts.text += 1;
    });

    const retention30 = users.length ? (activeUsers30 / users.length) * 100 : 0;
    const capsulesPerUser = users.length ? totalCapsules / users.length : 0;
    const sessionValues = users
      .map((u) => Number(u.sessionMinutes || u.avgSessionMinutes || u.avgSession || 0))
      .filter((v) => Number.isFinite(v) && v > 0);
    const avgSessionMin = sessionValues.length
      ? sessionValues.reduce((a, b) => a + b, 0) / sessionValues.length
      : 0;

    const trafficCounts = { direct: 0, social: 0, search: 0, referral: 0 };
    const trafficSources = new Set();
    users.forEach((u) => {
      const raw = String(u.refSource || u.source || u.referrer || u.utmSource || "").toLowerCase();
      if (!raw) {
        trafficCounts.direct += 1;
        return;
      }
      trafficSources.add(raw);
      if (raw.includes("google") || raw.includes("yandex") || raw.includes("search")) trafficCounts.search += 1;
      else if (raw.includes("facebook") || raw.includes("instagram") || raw.includes("tiktok") || raw.includes("vk") || raw.includes("telegram") || raw.includes("t.me")) trafficCounts.social += 1;
      else if (raw.includes("ref") || raw.includes("invite")) trafficCounts.referral += 1;
      else trafficCounts.direct += 1;
    });
    const trafficTotal =
      trafficCounts.direct + trafficCounts.social + trafficCounts.search + trafficCounts.referral;
    const traffic = trafficTotal
      ? {
          direct: Math.round((trafficCounts.direct / trafficTotal) * 100),
          social: Math.round((trafficCounts.social / trafficTotal) * 100),
          search: Math.round((trafficCounts.search / trafficTotal) * 100),
          referral: Math.max(
            0,
            100 -
              Math.round((trafficCounts.direct / trafficTotal) * 100) -
              Math.round((trafficCounts.social / trafficTotal) * 100) -
              Math.round((trafficCounts.search / trafficTotal) * 100)
          )
        }
      : { direct: 100, social: 0, search: 0, referral: 0 };

    const promoPrices = { month: 4.99, year: 59.88 };
    const promoUsed = promoCodes.filter((promo) => promo.usedAt);
    const currentMonthKey = monthKey(now);
    const promoUsedThisMonth = promoUsed.filter((promo) => {
      if (!promo.usedAt) return false;
      return monthKey(new Date(promo.usedAt)) === currentMonthKey;
    });
    const revenueMonthRaw = promoUsedThisMonth.reduce((sum, promo) => {
      const price = promoPrices[promo.duration] || 0;
      return sum + price;
    }, 0);
    const revenueMonth = Number(revenueMonthRaw.toFixed(2));
    const avgCheck = promoUsedThisMonth.length
      ? Number((revenueMonthRaw / promoUsedThisMonth.length).toFixed(2))
      : 0;
    const paymentsToday = promoUsed.filter((promo) => {
      if (!promo.usedAt) return false;
      return new Date(promo.usedAt).toDateString() === now.toDateString();
    }).length;

    const aiEnabled = Boolean(geminiKey || deepseekKey || apifreeKey || groqApiKey || azureOpenAIKey);
    const aiModelName =
      (geminiKey && `gemini:${geminiModel}`) ||
      (deepseekKey && `deepseek:${deepseekModel}`) ||
      (azureOpenAIDeployment && `azure:${azureOpenAIDeployment}`) ||
      (groqApiKey && groqModel) ||
      (apifreeKey && apifreeModel) ||
      "local";
    const usage = getAiUsage(store);
    const logs = Array.isArray(usage.logs) ? usage.logs : [];
    const nowMs = Date.now();
    const last24h = nowMs - 24 * 60 * 60 * 1000;
    const recent = logs.filter((l) => l && new Date(l.ts || 0).getTime() >= last24h);
    const aiRequestsBy2h = Array.from({ length: 12 }).map(() => 0);
    const aiLatencyBy2h = Array.from({ length: 12 }).map(() => 0);
    const aiLatencyCounts = Array.from({ length: 12 }).map(() => 0);
    recent.forEach((l) => {
      const ts = new Date(l.ts || 0).getTime();
      const hoursAgo = Math.max(0, Math.min(23.99, (nowMs - ts) / 3600000));
      const bucket = Math.min(11, Math.floor(hoursAgo / 2));
      aiRequestsBy2h[bucket] += 1;
      if (Number.isFinite(l.latencyMs)) {
        aiLatencyBy2h[bucket] += l.latencyMs / 1000;
        aiLatencyCounts[bucket] += 1;
      }
    });
    const aiLatencyAvg = aiLatencyBy2h.map((v, i) => (aiLatencyCounts[i] ? v / aiLatencyCounts[i] : 0));
    const aiRequestsLast24h = recent.length;
    const aiHasTraffic = aiRequestsLast24h > 0;
    const aiTokens7d = Array.from({ length: 7 }).map(() => 0);
    const aiTokens7dLabels = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(nowMs - (6 - idx) * 86400000);
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    });
    logs.forEach((l) => {
      const ts = new Date(l.ts || 0).getTime();
      const daysAgo = Math.floor((nowMs - ts) / 86400000);
      if (daysAgo < 0 || daysAgo > 6) return;
      const idx = 6 - daysAgo;
      const tokens = Math.max(1, Math.round((l.textLen || 0) / 4));
      aiTokens7d[idx] += tokens;
    });
    const aiLogs = logs
      .slice()
      .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
      .slice(0, 40)
      .map((l) => ({
        status: l.ok ? 'ok' : 'error',
        text: `${l.type === 'keeper_photo' ? 'AI photo' : 'AI chat'}${l.error === 'limit' ? ' (limit)' : ''}`,
        time: l.ts,
        user: l.email || l.userKey || 'guest'
      }));
    const aiLatencyVals = recent.filter((l) => Number.isFinite(l.latencyMs)).map((l) => l.latencyMs / 1000);
    const aiAvgLatencyVal = aiLatencyVals.length
      ? aiLatencyVals.reduce((a, b) => a + b, 0) / aiLatencyVals.length
      : 0;
    const aiLatencyNote = aiAvgLatencyVal ? (aiAvgLatencyVal > 1 ? 'slow' : 'ok') : 'no data';
    const aiErrors24h = recent.filter((l) => !l.ok).length;
    const aiLimitReachedUsers = new Set(
      recent.filter((l) => l.error === 'limit' && l.userKey).map((l) => l.userKey)
    ).size;

    const months = [];

    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      months.push({ key: monthKey(d), label: monthLabel(d) });
    }

    const usersByMonth = months.map((m) =>
      users.filter((u) => {
        const createdAt = userCreatedAtById.get(u.id);
        return createdAt && monthKey(new Date(createdAt)) === m.key;
      }).length
    );
    const capsulesByMonth = months.map((m) =>
      capsules.filter((c) => c.createdAt && monthKey(new Date(c.createdAt)) === m.key).length
    );

    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        key: getDayKey(d),
        label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
      });
    }
    const usersByDay = days.map((d) =>
      users.filter((u) => {
        const createdAt = userCreatedAtById.get(u.id);
        return createdAt && getDayKey(new Date(createdAt)) === d.key;
      }).length
    );
    const capsulesByDay = days.map((d) =>
      capsules.filter((c) => c.createdAt && getDayKey(new Date(c.createdAt)) === d.key).length
    );

    const events = [];
    users.forEach((u) => {
      const createdAt = userCreatedAtById.get(u.id);
      if (createdAt) {
        events.push({
          type: "user",
          time: createdAt,
          text: `${u.name || u.email || "Пользователь"} зарегистрировался`
        });
      }
      if (u.premiumUntil) {
        const usedAt = promoCodes.find((p) => p.usedBy === u.id && p.usedAt)?.usedAt;
        events.push({
          type: "premium",
          time: usedAt || u.premiumUntil,
          text: `${u.name || u.email || "Пользователь"} оформил Premium`
        });
      }
    });
    const userById = new Map(users.filter((u) => u.id).map((u) => [u.id, u]));
    promoCodes.forEach((p) => {
      if (!p.usedAt || !p.usedBy) return;
      const u = userById.get(p.usedBy);
      events.push({
        type: "promo",
        time: p.usedAt,
        text: `${(u && (u.name || u.email)) || "Пользователь"} активировал промокод ${p.code}`
      });
    });

    activeReviews.forEach((r) => {
      if (!r || r.deletedAt || !r.createdAt) return;
      const author =
        r.name ||
        r.author ||
        (r.userId && userById.get(r.userId) && (userById.get(r.userId).name || userById.get(r.userId).email)) ||
        r.email ||
        "Пользователь";
      events.push({
        type: "review",
        time: r.createdAt,
        text: `${author} оставил отзыв`
      });
    });

    capsules.forEach((c) => {
      if (c.createdAt) {
        events.push({
          type: "capsule",
          time: c.createdAt,
          text: `${c.name || "Пользователь"} создал капсулу`
        });
      }
      if (c.deliveredAt) {
        events.push({
          type: "delivered",
          time: c.deliveredAt,
          text: `Капсула доставлена`
        });
      }
    });
    events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const activityByHour = Array.from({ length: 12 }).map((_, idx) => {
      const hourStart = (idx * 2) % 24;
      return events.filter((e) => {
        const t = new Date(e.time);
        return t.getHours() >= hourStart && t.getHours() < hourStart + 2;
      }).length;
    });

    const publicWithGeo = capsules.filter((c) => c.visibility === "public" && c.lat && c.lng);
    const cityMap = new Map();
    publicWithGeo.forEach((c) => {
      const city = String(c.city || "Неизвестно").trim();
      const entry = cityMap.get(city) || { city, lat: c.lat, lng: c.lng, count: 0 };
      entry.count += 1;
      cityMap.set(city, entry);
    });
    const mapPoints = Array.from(cityMap.values()).sort((a, b) => b.count - a.count).slice(0, 50);

    const countryMap = new Map();
    publicWithGeo.forEach((c) => {
      const parts = String(c.city || "").split(",");
      const country = (parts[parts.length - 1] || "Другие").trim() || "Другие";
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
    });
    const countries = Array.from(countryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const capsuleCountByUser = new Map();
    capsules.forEach((c) => {
      if (!c.userId) return;
      capsuleCountByUser.set(c.userId, (capsuleCountByUser.get(c.userId) || 0) + 1);
    });

    const usersList = users
      .map((u) => ({
        id: u.id,
        name: u.name || u.email || "Пользователь",
        email: u.email || "",
        createdAt: userCreatedAtById.get(u.id) || u.createdAt || null,
        premium: isPremium(u),
        capsuleCount: capsuleCountByUser.get(u.id) || 0
      }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const capsulesList = capsules
      .map((c) => ({
        id: c.id,
        userId: c.userId,
        name: c.name || "Пользователь",
        visibility: c.visibility || "private",
        createdAt: c.createdAt || null,
        openDate: c.openDate || null,
        deliveredAt: c.deliveredAt || null,
        type: c.secretHash
          ? "secret"
          : c.audioUrl
          ? "voice"
          : c.photoUrl || c.videoUrl
          ? "photo"
          : "text"
      }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const reviewStats = buildReviewStats(activeReviews);
    const reviewItems = activeReviews
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 50);

    res.json({
      summary: {
        users: users.length,
        premiumUsers,
        publicCapsules,
        totalCapsules,
        deliveredTotal,
        deliveredToday,
        pendingDelivery,
        secretCapsules,
        activeUsers30,
        blockedUsers,
        newUsersMonth,
        conversion,
        revenue: revenueMonth,
        avgCheck,
        unusedPromoCodes
      },
      analytics: {
        retention30,
        capsulesPerUser,
        avgSessionMin,
        refSources: trafficSources.size,
        aiGuardUsers: 0,
        traffic
      },
      ai: {
        status: aiEnabled ? (aiHasTraffic ? "Online" : "Idle") : "Offline",
        uptime: aiEnabled ? (aiHasTraffic ? "99.8%" : "0%") : "0%",
        model: aiModelName,
        avgLatency: aiAvgLatencyVal,
        latencyNote: aiLatencyNote,
        requestsPerHour: Math.round(aiRequestsLast24h / 24),
        errors24h: aiErrors24h,
        limitPerDayFree: Number.isFinite(aiDailyLimitFree) ? aiDailyLimitFree : 0,
        limitPerDayPremium: Number.isFinite(aiDailyLimitPremium) ? aiDailyLimitPremium : 0,
        limitReachedUsers: aiLimitReachedUsers,
        requestsBy2h: aiRequestsBy2h,
        latencyBy2h: aiLatencyAvg,
        tokens7d: aiTokens7d,
        tokens7dLabels: aiTokens7dLabels,
        logs: aiLogs
      },
      growth: { labels: months.map((m) => m.label), users: usersByMonth, capsules: capsulesByMonth },
      growthDay: { labels: days.map((d) => d.label), users: usersByDay, capsules: capsulesByDay },
      capsulesByType: typeCounts,
      activity: events.slice(0, 20),
      activityByHour,
      mapPoints,
      countries,
      reviews: { ...reviewStats, items: reviewItems },
      usersList,
      capsulesList,
      promoCodes: promoCodes
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 50)
        .map((promo) => ({
          code: promo.code,
          duration: promo.duration,
          createdAt: promo.createdAt,
          usedBy: promo.usedBy || null,
          usedAt: promo.usedAt || null,
          disabledAt: promo.disabledAt || null
        })),
      adminProfile: store.adminProfile || { ...defaultStore.adminProfile },
      adminSettings: store.adminSettings || { ...defaultStore.adminSettings },
      today: {
        registrations: registrationsToday,
        capsulesCreated: capsulesCreatedToday,
        delivered: deliveredToday,
        payments: paymentsToday,
        deletions: 0
      }
    });
  } catch (e) {
    console.error("dashboard error:", e);
    const debugEnabled = process.env.NODE_ENV !== "production" || String(req.query?.debug || "") === "1";
    const details = debugEnabled
      ? (e && (e.stack || e.message) ? String(e.stack || e.message) : String(e))
      : undefined;
    res.status(500).json({ error: "Unable to load dashboard", details });
  }
});

app.get("/api/capsules", authRequired, async (req, res) => {
  const store = await readStore();
  const capsules = store.capsules
    .filter((capsule) => capsule.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(serializeCapsule);

  res.json({ capsules });
});

app.get("/api/public-capsules", async (_req, res) => {
  const store = await readStore();
  const capsules = store.capsules
    .filter((capsule) => capsule.visibility === "public")
    .map(serializePublicCapsule);

  res.json({ capsules });
});

app.post("/api/capsules/sync-location", authRequired, async (req, res) => {
  const city = String(req.body.city || "").trim();
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (!city || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Invalid location payload" });
  }

  const store = await readStore();
  let updated = 0;
  store.capsules = store.capsules.map((capsule) => {
    if (capsule.userId !== req.user.id) return capsule;
    if (!isPlaceholderCity(capsule.city) && Number.isFinite(Number(capsule.lat)) && Number.isFinite(Number(capsule.lng)) && Number(capsule.lat) !== 0 && Number(capsule.lng) !== 0) {
      return capsule;
    }
    updated += 1;
    return {
      ...capsule,
      city,
      lat,
      lng
    };
  });
  await writeStore(store);

  res.json({ updated });
});

app.post("/api/capsules", authRequired, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normalizeEmail(req.body.email);
  const message = String(req.body.message || "").trim();
  const openDate = String(req.body.openDate || "");
  const visibility = req.body.visibility === "private" ? "private" : "public";
  const prediction = req.body.prediction ? String(req.body.prediction) : null;
  const style = String(req.body.style || "classic").trim().toLowerCase();
  const photoUrl = req.body.photoUrl ? String(req.body.photoUrl).trim() : "";
  const videoUrl = req.body.videoUrl ? String(req.body.videoUrl).trim() : "";
  const audioUrl = req.body.audioUrl ? String(req.body.audioUrl).trim() : "";
  const emoji = req.body.emoji ? String(req.body.emoji).trim() : "";
  const secret = Boolean(req.body.secret);
  const secretPassword = req.body.secretPassword ? String(req.body.secretPassword) : "";
  const hunt = Boolean(req.body.hunt);
  const city = String(req.body.city || "").trim() || "Your City";
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (!name || !email || !message || Number.isNaN(new Date(openDate).getTime())) {
    return res.status(400).json({ error: "Invalid capsule payload" });
  }

  if (email !== req.user.email) {
    return res.status(400).json({ error: "Capsule email must match the account email" });
  }

  if (message.length > 5000) {
    return res.status(400).json({ error: "Message is too long" });
  }

  const store = await readStore();
  const currentUser = store.users.find((entry) => entry.id === req.user.id);
  if (!currentUser) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!hasActivePremium(currentUser)) {
    const totalCapsules = store.capsules.filter((capsule) => capsule.userId === req.user.id).length;
    if (totalCapsules >= 1) {
      return res.status(403).json({ error: "Free plan limit reached: 1 capsule total. Activate Premium to continue." });
    }
    if (photoUrl || videoUrl) {
      return res.status(403).json({ error: "Premium required to attach photo or video" });
    }
    if (audioUrl) {
      return res.status(403).json({ error: "Premium required to attach voice message" });
    }
    if (secret) {
      return res.status(403).json({ error: "Premium required to protect a capsule with a password" });
    }
    if (hunt) {
      return res.status(403).json({ error: "Premium required for Secret Capsule Hunt" });
    }
    if (style && style !== "classic") {
      return res.status(403).json({ error: "Premium required for capsule styles" });
    }
  }

  if (!isValidPhotoUrl(photoUrl) || !isValidVideoUrl(videoUrl) || !isValidAudioUrl(audioUrl)) {
    return res.status(400).json({ error: "Invalid media link" });
  }
  if (!isValidEmoji(emoji)) {
    return res.status(400).json({ error: "Invalid emoji selection" });
  }
  const allowedStyles = new Set(["classic", "gold", "emerald", "noir"]);
  if (!allowedStyles.has(style)) {
    return res.status(400).json({ error: "Invalid capsule style" });
  }
  if (hunt && visibility !== "public") {
    return res.status(400).json({ error: "Secret Capsule Hunt requires public visibility" });
  }
  if (hunt && secret) {
    return res.status(400).json({ error: "Secret Capsule Hunt cannot be combined with secret capsules" });
  }
  if (secret && String(secretPassword || "").length < 4) {
    return res.status(400).json({ error: "Secret password must be at least 4 characters" });
  }

  const secretHash = secret ? await bcrypt.hash(secretPassword, 10) : null;

  if (!isCapsuleAllowed({ message, prediction })) {
    return res.status(400).json({ error: "Unsafe or abusive content is not allowed" });
  }

  const capsule = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    name,
    email,
    message,
    openDate,
    visibility,
    prediction,
    style,
    photoUrl: photoUrl || null,
    videoUrl: videoUrl || null,
    audioUrl: audioUrl || null,
    hunt,
    secretHash,
    emoji: emoji || null,
    emotion: null,
    futureScene: null,
    createdAt: new Date().toISOString(),
    city,
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    deliveredAt: null
  };

  store.capsules.push(capsule);
  await writeStore(store);

  res.status(201).json({ capsule: serializeCapsule(capsule) });
});

app.post("/api/capsules/open", authRequired, async (req, res) => {
  const id = String(req.body.id || "").trim();
  const password = String(req.body.password || "");
  if (!id) {
    return res.status(400).json({ error: "Capsule id is required" });
  }

  const store = await readStore();
  const capsule = store.capsules.find((entry) => entry.id === id);
  if (!capsule) {
    return res.status(404).json({ error: "Capsule not found" });
  }

  const isOwner = capsule.userId === req.user.id;
  const isPublic = capsule.visibility === "public";
  const openReady = new Date(capsule.openDate || 0).getTime() <= Date.now();

  if (!isPublic && !isOwner) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (capsule.secretHash) {
    if (!isOwner) {
      return res.status(403).json({ error: "Secret capsule can only be opened by the author" });
    }
    if (!openReady) {
      return res.status(403).json({ error: "Capsule is not open yet" });
    }
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }
    const ok = await bcrypt.compare(password, capsule.secretHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid password" });
    }
  } else if (isOwner) {
    return res.status(403).json({ error: "Own capsule is locked" });
  } else if (!isPublic && !openReady) {
    return res.status(403).json({ error: "Capsule is not open yet" });
  }

  res.json({ capsule: serializeCapsule(capsule) });
});

function isAuthorizedJob(req) {
  if (req.headers["x-job-secret"] === jobSecret) {
    return true;
  }
  if (process.env.VERCEL && req.headers["x-vercel-cron"] === "1") {
    return true;
  }
  return false;
}

app.post("/api/jobs/send-due-capsules", async (req, res) => {
  if (!isAuthorizedJob(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await deliverDueCapsules();
  res.json(result);
});

app.post("/api/jobs/send-daily-reminders", async (req, res) => {
  if (!isAuthorizedJob(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await sendDailyReminders();
  res.json(result);
});

app.get("/api/jobs/send-due-capsules", async (req, res) => {
  if (!isAuthorizedJob(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await deliverDueCapsules();
  res.json(result);
});

app.get("/api/jobs/send-daily-reminders", async (req, res) => {
  if (!isAuthorizedJob(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await sendDailyReminders();
  res.json(result);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.get("/admin", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.redirect(302, "/admin-panel");
});

app.get("/admin-panel", (_req, res) => {
  const htmlPath = path.join(rootDir, "admin.html");
  try {
    const html = fs.readFileSync(htmlPath);
    res.status(200);
    res.set("Content-Type", "text/html; charset=UTF-8");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("X-Content-Type-Options", "nosniff");
    res.send(html);
  } catch (e) {
    res.status(500).send("admin.html not found");
  }
});

app.get("/i18n.extra.js", (_req, res) => {
  res.sendFile(path.join(rootDir, "i18n.extra.js"));
});

app.get("/chart.umd.min.js", (_req, res) => {
  res.sendFile(path.join(rootDir, "chart.umd.min.js"));
});

app.get("/seal-sound.mp3", (_req, res) => {
  res.sendFile(path.join(rootDir, "_ui_window_close_menu_screen_03_normal.mp3"));
});

app.get("/hammer-sound.mp3", (_req, res) => {
  res.sendFile(path.join(rootDir, "0be1c1022f8ed63.mp3"));
});

app.get("/windy-sound-effects.mp3", (_req, res) => {
  res.sendFile(path.join(rootDir, "windy-sound-effects.mp3"));
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

if (!process.env.VERCEL) {
  ensureStore().catch((error) => {
    console.error("Store init failed:", error.message);
  });

  app.listen(port, () => {
    console.log(`DearFutureMe server running at ${appBaseUrl}`);
  });

  setInterval(() => {
    deliverDueCapsules().catch((error) => {
      console.error("Email delivery failed:", error.message);
    });
  }, 60000);

  setInterval(() => {
    sendDailyReminders().catch((error) => {
      console.error("Reminder delivery failed:", error.message);
    });
  }, 3600000);
}

module.exports = app;
